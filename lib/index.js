// @ts-check
/**
 * dsh-opencode-go-usage — host half.
 *
 * Watches your OpenCode GO plan quota through the official gateway endpoint
 * (`https://opencode.ai/zen/go/v1/usage`). Proxied through a same-origin route
 * so the browser widget never sees your API key and no CORS is involved.
 *
 * - `GET /opencode-go/usage` — quota proxy (rolling / weekly / monthly window
 *   percentages from the official API).
 * - `/opencode-go` chat command — prints the same numbers as text.
 * - Sidebar widget — the browser half is picked up by the official
 *   client-modules scan (`dsh.client` + `exports["./client"]`), so it works
 *   from any installation location in DSH 2.x.
 *
 * Installation / configuration (official DSH flows):
 *   - Install: `dsh plugin --profile web add @astervolans/dsh-opencode-go-usage` — the
 *     `dsh.bundle.patch` declaration makes the CLI reconcile this package into
 *     the profile's bundle layer stack automatically (no manual patch edits).
 *   - Configure: the loader picks the exported `Config` schema up by itself —
 *     DSH 2.x removed `ctx.settings.register`, so this plugin no longer
 *     registers a namespace by hand. Every field is `.volatile()`, which is
 *     what surfaces it in Settings → Plugins → Plugin configuration and lets
 *     edits hot-apply; a legacy `~/.dsh/settings.yaml` section is migrated
 *     into this entry by the host on first boot. The API key itself lives in
 *     the credentials domain (`OPENCODE_GO_API_KEY`), never in settings.
 *
 * Config fields:
 *   - apiKeyEnv:    credential ref / env var for the API key (default OPENCODE_GO_API_KEY)
 *   - baseUrl:      GO gateway base (default https://opencode.ai/zen/go)
 *   - cacheMs:      host-side cache TTL (default 30000)
 *   - updateCheck:  check npm for newer versions (default true); result shows
 *                   in the widget and the command — the plugin never installs
 *                   itself, upgrading stays an explicit user action.
 *   - injectSessionHeader: runtime `x-opencode-session` fix (default true);
 *                   the GO gateway 400s chat requests without it. The gateway
 *                   base is read from the called provider's own live config
 *                   (`llm-pi-ai.providers.<route>.baseURL` via the loader), so
 *                   no host names are hard-coded.
 */

import { readFileSync } from "node:fs";
import z from "@deepseek-ai/schemastery";
import { patchFetch, recordStream, sessionDiag, sessionHeaderCount, withSession } from "./opencode-session.js";

export const name = "dsh-opencode-go-usage";

/** Required services: web routes, chat commands, credentials. */
export const inject = ["webServer", "commands", "credentials"];

/** Settings namespace owned by this plugin. */
export const namespace = "dsh-opencode-go-usage";

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go";
const DEFAULT_API_KEY_ENV = "OPENCODE_GO_API_KEY";
const DEFAULT_CACHE_MS = 30_000;
/** npm package name this plugin is published under (update checks). */
const NPM_PACKAGE = "@astervolans/dsh-opencode-go-usage";
/** How often the update check may hit the npm registry (ms). */
const UPDATE_CHECK_INTERVAL_MS = 24 * 3600_000;

/** The version this running copy was installed as (read once at load). */
const CURRENT_VERSION = readPackageVersion();

/** Read `version` from the installed package.json next to this file. */
function readPackageVersion() {
	try {
		const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
		if (typeof pkg?.version === "string") return pkg.version;
	} catch {
		// fall through
	}
	return "0.0.0";
}

/** Compare two `x.y.z` version strings; returns true when `a` is newer than `b`. */
function isNewer(a, b) {
	const pa = String(a).split("-")[0].split(".").map(Number);
	const pb = String(b).split("-")[0].split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		const na = pa[i] ?? 0;
		const nb = pb[i] ?? 0;
		if (na !== nb) return na > nb;
	}
	return false;
}

/**
 * Mark one field live-editable when the resolved schemastery supports it.
 *
 * `.volatile()` only exists in schemastery >= 3.18.4, and DSH resolves a
 * plugin's own dependencies from the profile first — so an older hoisted copy
 * (e.g. 3.18.2, installed while the plugin's range still allowed it) wins over
 * the installation's newer one, and an unguarded call fails activation with
 * `TypeError: ...volatile is not a function`. With an older copy the plugin
 * still activates from its entry config; it only loses the auto-generated
 * settings page and hot-edit, which need real volatile refs.
 * @template T
 * @param {T} field
 * @returns {T}
 */
function live(field) {
	return typeof field?.volatile === "function" ? field.volatile() : field;
}

/**
 * Settings schema for this plugin's namespace.
 *
 * DSH 2.x details:
 * - Fields are marked live/volatile (see {@link live}), so they appear in
 *   Settings → Plugins → Plugin configuration and edits hot-apply (the host
 *   mutates the running volatile refs; this plugin re-reads config on every
 *   request/command).
 * - The loader consumes `Config` directly — no `ctx.settings.register` (that
 *   service method was removed in 2.x, and calling it fails activation with
 *   `TypeError: ctx.settings.register is not a function`).
 * - `apiKeyEnv` is a credential ref (`role("credential-ref")`), mirroring
 *   DSH's own providers; the value itself stays out of settings.
 * - `injectSessionHeader` enables the runtime `x-opencode-session` fix: the
 *   gateway 400s chat-completion requests without it (see lib/opencode-session.js).
 */
export const Config = z.object({
	apiKeyEnv: live(z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV)),
	baseUrl: live(z.string().default(DEFAULT_BASE_URL)),
	cacheMs: live(z.number().default(DEFAULT_CACHE_MS)),
	updateCheck: live(z.boolean().default(true)),
	injectSessionHeader: live(z.boolean().default(true))
});

/**
 * Resolve the API key through the DSH credentials service
 * (process env, `$DSH_HOME/.credentials.yaml`, `.env` layers).
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string} refName
 */
async function resolveApiKey(ctx, refName) {
	const hit = await ctx.credentials.resolve(refName);
	return hit?.value ?? null;
}

/** Entry ids / package names probed when reading another plugin's live config. */
const LOCALE_ENTRY_SOURCES = ["locale", "@deepseek-ai/dsh-client-locale"];
const PI_AI_ENTRY_SOURCES = ["llm-pi-ai", "@deepseek-ai/dsh-llm-pi-ai"];

/** Unwrap a cosmokit volatile reference (schema `.volatile()` fields resolve to refs). */
function unwrap(value) {
	return value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value;
}

/**
 * Read another profile entry's resolved config from the loader. `sources` is
 * probed as (entry id, then package name); the first active match wins.
 * Returns `undefined` when no match is live yet — callers fall back to their
 * own defaults, so load order never blocks activation.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string[]} sources
 * @returns {Record<string, unknown> | undefined}
 */
function liveEntryConfig(ctx, sources) {
	const loader = ctx.loader ?? ctx.root?.loader;
	if (!loader || typeof loader.entries !== "function") return undefined;
	for (const probe of sources) {
		for (const entry of loader.entries()) {
			if (!entry?.fiber || entry.fiber.uid == null || entry.disabled) continue;
			if (entry.options?.id === probe || entry.options?.name === probe) return entry.fiber.config;
			// The computed id carries the owning group's prefix; reading it can
			// throw for an entry with no parent group, so it is probed last.
			let qualified;
			try {
				qualified = entry.id;
			} catch {
				qualified = undefined;
			}
			if (qualified === probe) return entry.fiber.config;
		}
	}
	return undefined;
}

/** Fetch the GO plan quota payload from the gateway. */
async function fetchUsage(baseUrl, apiKey) {
	const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/usage`, {
		headers: { Authorization: `Bearer ${apiKey}` },
		signal: AbortSignal.timeout(15_000)
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`gateway ${res.status}: ${body.slice(0, 300)}`);
	}
	return await res.json();
}

/** Human-friendly chat output, localized (zh | en). */
function renderUsageText(data, lang) {
	const zh = lang !== "en";
	const u = data?.usage;
	if (!u || typeof u !== "object") return "OpenCode GO: unexpected response shape.";
	const lines = [zh ? "OpenCode GO 套餐用量:" : "OpenCode GO plan usage:"];
	const defs = [
		["rolling", zh ? "滚动窗口 (5h)" : "Rolling (5h)"],
		["weekly", zh ? "周窗口" : "Weekly"],
		["monthly", zh ? "月窗口" : "Monthly"]
	];
	for (const [key, label] of defs) {
		const w = u[key];
		if (!w || typeof w.percent !== "number") continue;
		const status = w.status === "ok" ? (zh ? "正常" : "ok") : w.status;
		const resets = w.resetsAt
			? (zh ? `重置于 ${new Date(w.resetsAt).toLocaleString("zh-CN")}` : `resets at ${new Date(w.resetsAt).toLocaleString("en-US")}`)
			: "";
		lines.push(`  ${label}: ${w.percent}% (${status})${resets ? `, ${resets}` : ""}`);
	}
	return lines.join("\n");
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, unknown>} config - the resolved plugin config
 *   (validated against the exported `Config` schema; schema defaults applied).
 *   DSH 2.x hands this in directly — the loader owns the schema, the profile
 *   patch (or the migrated legacy settings.yaml) supplies overrides, and
 *   volatile values arrive as live refs the settings page updates in place.
 */
export function apply(ctx, config = {}) {
	const readConfig = () => {
		const own = unwrap(config);
		const localeEntry = liveEntryConfig(ctx, LOCALE_ENTRY_SOURCES) ?? {};
		const preference = unwrap(localeEntry.preference);
		return {
			apiKeyEnv: unwrap(own.apiKeyEnv) ?? DEFAULT_API_KEY_ENV,
			baseUrl: unwrap(own.baseUrl) ?? DEFAULT_BASE_URL,
			cacheMs: typeof unwrap(own.cacheMs) === "number" ? unwrap(own.cacheMs) : DEFAULT_CACHE_MS,
			updateCheck: unwrap(own.updateCheck) !== false,
			injectSessionHeader: unwrap(own.injectSessionHeader) !== false,
			// DSH's own locale preference (live entry config); absent falls
			// back to zh (the browser decides when the user never picked).
			locale: typeof preference === "string" ? preference : "zh"
		};
	};

	// ── runtime x-opencode-session injection ───────────────────────────────
	// The GO gateway rejects chat-completion requests without
	// `x-opencode-session` (HTTP 400 MissingSessionID) and DSH's pi-ai adapter
	// never sends it. Instead of patching DSH's installed files (wiped by
	// every upgrade), wrap globalThis.fetch once and stand on the official
	// `llm/stream` waterfall to learn the per-call harness session id, so
	// every GO gateway request carries the real, per-conversation session id
	// (see lib/opencode-session.js). The gateway base is resolved from the
	// called provider's OWN live config — the `llm-pi-ai` entry's
	// `providers.<route>.baseURL` — so no host names are ever hard-coded, and
	// other providers are untouched (the fetch wrapper only fires when the URL
	// matches that call's base).
	if (readConfig().injectSessionHeader) {
		patchFetch();
		ctx.on("llm/stream", (options, next) => {
			const info = {
				provider: options.provider ?? null,
				hasSessionId: options.sessionId !== void 0,
				base: null,
				baseFrom: /** @type {"settings" | "config" | null} */ (null)
			};
			if (options.sessionId === void 0) {
				recordStream(info);
				return next();
			}
			const providers = unwrap(liveEntryConfig(ctx, PI_AI_ENTRY_SOURCES)?.providers);
			const configured = providers?.[options.provider]?.baseURL;
			const base = typeof configured === "string" && configured.length > 0 ? configured : readConfig().baseUrl;
			info.base = typeof base === "string" ? base : null;
			info.baseFrom = typeof configured === "string" && configured.length > 0 ? "settings" : "config";
			recordStream(info);
			if (typeof base !== "string" || base.length === 0) return next();
			return withSession(next(), { sessionId: String(options.sessionId), base });
		});
	}

	// ── update check (npm) ─────────────────────────────────────────────────
	// Checks the registry at most once per UPDATE_CHECK_INTERVAL_MS; failures
	// are silent. The plugin only reports — upgrading stays a user action
	// (`dsh plugin --profile web add @astervolans/dsh-opencode-go-usage@latest`).
	/** @type {{ at: number, latest: string | null } | null} */
	let updateState = null;
	const checkForUpdate = async (config) => {
		const now = Date.now();
		if (updateState !== null && now - updateState.at < UPDATE_CHECK_INTERVAL_MS) return updateState;
		const snapshot = { at: now, latest: null };
		try {
			const res = await fetch(`https://registry.npmjs.org/${NPM_PACKAGE}/latest`, {
				signal: AbortSignal.timeout(10_000)
			});
			if (res.ok) {
				const json = await res.json();
				if (typeof json?.version === "string" && isNewer(json.version, CURRENT_VERSION)) {
					snapshot.latest = json.version;
				}
			}
		} catch {
			// offline / registry hiccup — keep the previous result, refresh later
			snapshot.at = updateState?.at ?? now;
			snapshot.latest = updateState?.latest ?? null;
		}
		updateState = snapshot;
		return snapshot;
	};
	const updateInfoOf = (config) => {
		const st = updateState;
		if (!config.updateCheck || st === null || st.latest === null) {
			return { current: CURRENT_VERSION, available: false, latest: null };
		}
		return { current: CURRENT_VERSION, available: true, latest: st.latest };
	};

	// Kick off the first check shortly after boot (non-blocking).
	void checkForUpdate(readConfig()).catch(() => {});

	// Host-side cache: one in-flight promise + a TTL, so several open tabs or
	// the command never hammer the gateway.
	/** @type {{ at: number, promise: Promise<unknown> } | null} */
	let quotaCache = null;
	const quotaOnce = () => {
		const now = Date.now();
		const config = readConfig();
		if (quotaCache !== null && now - quotaCache.at < config.cacheMs) return quotaCache.promise;
		const promise = (async () => {
			const key = await resolveApiKey(ctx, config.apiKeyEnv);
			if (key === null) {
				throw new Error(config.locale === "en"
					? `OpenCode GO: no API key (set credential ${config.apiKeyEnv})`
					: `OpenCode GO: 未配置 API key(在 credential ${config.apiKeyEnv} 中设置)`);
			}
			return await fetchUsage(config.baseUrl, key);
		})();
		quotaCache = { at: now, promise };
		promise.catch(() => { if (quotaCache?.promise === promise) quotaCache = null; });
		return promise;
	};

	const handleUsage = async (_req, res) => {
		res.setHeader("content-type", "application/json; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		try {
			const config = readConfig();
			// Trigger a background refresh when the interval elapsed (never
			// block the response on the registry).
			void checkForUpdate(config).catch(() => {});
			const data = await quotaOnce();
			res.end(JSON.stringify({
				...data,
				update: updateInfoOf(config),
				sessionHeader: { active: config.injectSessionHeader, count: sessionHeaderCount(), diag: sessionDiag() }
			}));
		} catch (error) {
			res.statusCode = 502;
			res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
		}
	};

	// Same-origin route the browser widget polls.
	ctx.webServer.register({
		kind: "exact",
		path: "/opencode-go/usage",
		handler: handleUsage
	});

	// ── browser widget ─────────────────────────────────────────────────────
	// DSH 2.x composes the widget through the official client-modules scan:
	// this package's `dsh.client` declaration and `exports["./client"]` are
	// picked up per loader entry, the bundle is served from the /plugins combo
	// routes, and its boot-graph row lands in the `window.__DSH_BOOT__`
	// manifest by the host itself. The 1.x mechanism (self-hosted bundle route
	// + `webServer.tapIndex` row injection) was removed: it wrote into the old
	// array-shaped boot manifest, which 2.x replaced with a `{ rev, entries,
	// batches }` object — hand-appending a row there would fail the boot
	// parser, and the client-modules scanner already does this for any
	// installation location.

	// Chat command so the numbers are reachable from a conversation too.
	ctx.commands.register({
		name: "opencode-go",
		description: "show OpenCode GO plan usage (rolling/weekly/monthly windows)",
		handler: async () => {
			try {
				const config = readConfig();
				const data = await quotaOnce();
				let text = renderUsageText(data, config.locale);
				const update = updateInfoOf(config);
				if (update.available && update.latest !== null) {
					text += config.locale === "en"
						? `\n\nUpdate available: v${update.latest} — run \`dsh plugin --profile web add ${NPM_PACKAGE}@latest\` to upgrade.`
						: `\n\n发现新版本 v${update.latest} — 执行 \`dsh plugin --profile web add ${NPM_PACKAGE}@latest\` 升级。`;
				}
				return { kind: "success", text };
			} catch (error) {
				return { kind: "error", text: error instanceof Error ? error.message : String(error) };
			}
		}
	});
}
