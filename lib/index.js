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
import { createRequire } from "node:module";
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

/**
 * Quota sources this plugin can display.
 *
 * - `opencode-go`: prefer the `dsh-opencode-go` plugin's own usage service, so
 *   the numbers match its settings page and follow its active account (and any
 *   automatic account switch). Falls back to the built-in provider when that
 *   plugin is absent, disabled, or incompatible.
 * - `builtin`: the 1.x path — `baseUrl` + `/v1/usage` with `apiKeyEnv`.
 */
export const QUOTA_SOURCES = ["opencode-go", "builtin"];
/** Default source: use the richer plugin integration when it is available. */
export const DEFAULT_QUOTA_SOURCE = "opencode-go";
/** Profile entry ids / package names probed for the dsh-opencode-go config. */
const OPENCODE_GO_ENTRY_SOURCES = ["opencode-go", "dsh-opencode-go"];
/** npm package whose live usage service is read in `opencode-go` mode. */
const OPENCODE_GO_PACKAGE = "dsh-opencode-go";
/** Cordis service dsh-opencode-go registers for host-side usage reads. */
const OPENCODE_GO_USAGE_SERVICE = "opencodeGoUsage";
/** Fallback account reference when dsh-opencode-go omits `apiKeyEnv`. */
const OPENCODE_GO_DEFAULT_ACCOUNT_REF = "OPENCODE_API_KEY";
/** Resolves packages relative to this file (the profile's node_modules). */
const pluginRequire = createRequire(import.meta.url);

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
	injectSessionHeader: live(z.boolean().default(true)),
	quotaSource: live(z.union([
		z.const("opencode-go"),
		z.const("builtin")
	]).default(DEFAULT_QUOTA_SOURCE).description(
		"Quota source: \"opencode-go\" follows the dsh-opencode-go plugin's active account and falls back to the built-in provider when it is unavailable; \"builtin\" always uses apiKeyEnv/baseUrl."
	))
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

/** Normalize a user-supplied quota source; unknown values take the default. */
export function normalizeQuotaSource(value) {
	return value === "builtin" ? "builtin" : DEFAULT_QUOTA_SOURCE;
}

/** Read the installed dsh-opencode-go version, or null when it is not installed. */
function opencodeGoVersion() {
	try {
		const path = pluginRequire.resolve(`${OPENCODE_GO_PACKAGE}/package.json`);
		const pkg = JSON.parse(readFileSync(path, "utf8"));
		return typeof pkg?.version === "string" ? pkg.version : null;
	} catch {
		return null;
	}
}

/**
 * Validate a usage payload and project the three windows to plain objects.
 * Accepts both `{ usage: {...} }` (the gateway shape this plugin already
 * proxies) and dsh-opencode-go's flat `{ rolling, weekly, monthly }` shape.
 * Throws instead of turning absent data into zeroes.
 * @param {unknown} payload
 */
export function normalizeUsagePayload(payload) {
	const usage = payload !== null && typeof payload === "object" && payload.usage !== null && typeof payload.usage === "object"
		? payload.usage
		: payload;
	const out = {};
	for (const key of ["rolling", "weekly", "monthly"]) {
		const row = usage?.[key];
		if (row === null || typeof row !== "object" || typeof row.percent !== "number" || !Number.isFinite(row.percent)) {
			throw new Error(`invalid usage payload: missing ${key}.percent`);
		}
		out[key] = {
			status: typeof row.status === "string" ? row.status : "ok",
			percent: row.percent,
			resetsAt: typeof row.resetsAt === "string" ? row.resetsAt : null
		};
	}
	return out;
}

/**
 * Find one loader entry by id or package name, including a disabled entry.
 * Unlike {@link liveEntryConfig} this does not skip `entry.disabled`: the
 * difference between "not installed" and "installed but disabled" is exactly
 * what the settings page and the fallback badge report.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {string[]} sources
 */
function findLoaderEntry(ctx, sources) {
	try {
		const loader = ctx.loader ?? ctx.root?.loader;
		if (!loader || typeof loader.entries !== "function") return null;
		for (const entry of loader.entries()) {
			if (entry === null || typeof entry !== "object") continue;
			if (sources.includes(entry.options?.id) || sources.includes(entry.options?.name)) return entry;
			let qualified;
			try {
				qualified = entry.id;
			} catch {
				qualified = undefined;
			}
			if (sources.includes(qualified)) return entry;
		}
	} catch {
		// an unavailable loader reads as "not installed"
	}
	return null;
}

/**
 * Read the active-account metadata of the dsh-opencode-go profile entry.
 *
 * dsh-opencode-go selects the active account by `apiKeyEnv` and keeps the
 * accounts list re-ordered so that entry is first; reading the same two
 * fields reproduces its choice without touching its internals. Returns
 * `found: false` when the entry is absent, and `enabled: false` when it is
 * installed but disabled (loader-level or `config.enabled: false`).
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
function opencodeGoEntryInfo(ctx) {
	const entry = findLoaderEntry(ctx, OPENCODE_GO_ENTRY_SOURCES);
	if (entry === null) {
		return { found: false, enabled: null, baseURL: null, ref: null, account: null, accounts: [] };
	}
	const inactive = entry.disabled === true || entry.fiber === null || entry.fiber === undefined || entry.fiber.uid == null;
	/** @type {Record<string, unknown>} */
	const cfg = inactive ? {} : (entry.fiber.config ?? {});
	let enabled = inactive ? false : true;
	if (!inactive) {
		try {
			enabled = unwrap(cfg.enabled) !== false;
		} catch {
			// an unreadable live ref keeps the documented default (enabled)
		}
	}
	let ref = OPENCODE_GO_DEFAULT_ACCOUNT_REF;
	try {
		const value = unwrap(cfg.apiKeyEnv);
		if (typeof value === "string" && value.length > 0) ref = value;
	} catch {
		// keep the default ref
	}
	/** @type {Array<Record<string, unknown>>} */
	let accounts = [];
	try {
		const value = unwrap(cfg.accounts);
		if (Array.isArray(value)) accounts = value.filter((account) => account !== null && typeof account === "object");
	} catch {
		// no account list → a legacy single-key profile
	}
	const hit = accounts.find((account) => account.apiKeyEnv === ref) ?? null;
	let baseURL = null;
	try {
		const value = unwrap(cfg.baseURL);
		if (typeof value === "string" && value.length > 0) baseURL = value;
	} catch {
		// callers fall back to the plugin's own baseUrl
	}
	return {
		found: true,
		enabled,
		baseURL,
		ref,
		account: {
			ref,
			id: typeof hit?.id === "string" ? hit.id : null,
			name: typeof hit?.name === "string" ? hit.name : ""
		},
		accounts: accounts.map((account) => ({
			ref: typeof account.apiKeyEnv === "string" ? account.apiKeyEnv : "",
			name: typeof account.name === "string" ? account.name : ""
		}))
	};
}

/**
 * The dsh-opencode-go host usage service, or null when that plugin is absent
 * or too old to register it. `ctx.get` is intentionally used instead of an
 * `inject` dependency: a missing service must not block this plugin from
 * activating, and the lookup itself is what drives the fallback.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
function opencodeGoService(ctx) {
	try {
		if (typeof ctx.get !== "function") return null;
		const service = ctx.get(OPENCODE_GO_USAGE_SERVICE);
		return service !== null && typeof service?.read === "function" ? service : null;
	} catch {
		return null;
	}
}

/** Public (JSON-safe) view of a probe result. */
function publicProbe(probe) {
	return {
		detected: probe.detected === true,
		version: probe.version ?? null,
		entryFound: probe.entryFound === true,
		enabled: probe.enabled ?? null,
		service: probe.service === true,
		compatible: probe.compatible === true,
		reason: probe.reason ?? null,
		message: probe.message ?? null
	};
}

/** Base probe metadata shared by every detection path. */
function probeBase(ctx) {
	const info = opencodeGoEntryInfo(ctx);
	const version = opencodeGoVersion();
	const service = opencodeGoService(ctx);
	return {
		info,
		probe: {
			detected: info.found || version !== null,
			version,
			entryFound: info.found,
			enabled: info.enabled,
			service: service !== null,
			compatible: false,
			reason: null,
			message: null
		}
	};
}

/**
 * Read the active account's usage through dsh-opencode-go's own service.
 * Every failure is returned (never thrown) so the caller can fall back and
 * report the exact reason.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
async function readViaOpencodeGo(ctx) {
	const { info, probe } = probeBase(ctx);
	if (!info.found) {
		return { ...probe, ok: false, reason: "not-installed", message: "dsh-opencode-go is not installed, or its profile entry is inactive" };
	}
	if (info.enabled === false) {
		return { ...probe, ok: false, reason: "entry-disabled", message: "dsh-opencode-go is installed but disabled in this profile", account: info.account };
	}
	const service = opencodeGoService(ctx);
	if (service === null) {
		return { ...probe, ok: false, reason: "service-unavailable", message: "dsh-opencode-go does not expose the opencodeGoUsage service (unsupported version)", account: info.account };
	}
	let raw;
	try {
		raw = await service.read();
	} catch (error) {
		return {
			...probe,
			ok: false,
			reason: "read-failed",
			message: error instanceof Error ? error.message : String(error),
			account: info.account
		};
	}
	let usage;
	try {
		usage = normalizeUsagePayload(raw);
	} catch (error) {
		return {
			...probe,
			ok: false,
			reason: "invalid-response",
			message: error instanceof Error ? error.message : String(error),
			account: info.account
		};
	}
	const lastSwitch = raw !== null && typeof raw === "object" && raw.lastSwitch !== null && typeof raw.lastSwitch === "object"
		? raw.lastSwitch
		: null;
	return {
		...probe,
		ok: true,
		compatible: true,
		usage,
		account: info.account,
		lastSwitch
	};
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
	const source = data?.source === "builtin"
		? (zh ? "DSH 内置提供商" : "DSH built-in provider")
		: "dsh-opencode-go";
	const account = typeof data?.account?.name === "string" && data.account.name.length > 0
		? data.account.name
		: (zh ? "默认账号" : "default account");
	lines.push(zh ? `  来源: ${source}（${account}）` : `  Source: ${source} (${account})`);
	if (data?.fallback) {
		const reason = data.fallback.message || data.fallback.reason || "";
		lines.push(zh ? `  已回退到内置提供商: ${reason}` : `  Fell back to the built-in provider: ${reason}`);
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
			quotaSource: normalizeQuotaSource(unwrap(own.quotaSource)),
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
	// the command never hammer the gateway. The key includes the resolved
	// source and, for the plugin path, the active dsh-opencode-go account: a
	// settings switch or an account auto-switch must never serve the previous
	// account's numbers.
	/** @type {{ at: number, key: string, promise: Promise<unknown> } | null} */
	let quotaCache = null;

	/** Cache identity for the current config + active dsh-opencode-go account. */
	const quotaCacheKey = (config) => {
		if (config.quotaSource !== "opencode-go") return `${config.quotaSource}|${config.apiKeyEnv}|${config.baseUrl}`;
		const info = opencodeGoEntryInfo(ctx);
		return `${config.quotaSource}|${info.ref ?? ""}|${config.apiKeyEnv}|${config.baseUrl}`;
	};

	/** The 1.x path: built-in provider config + `apiKeyEnv` credential. */
	const readViaBuiltin = async (config) => {
		const key = await resolveApiKey(ctx, config.apiKeyEnv);
		if (key === null) {
			throw new Error(config.locale === "en"
				? `OpenCode GO: no API key (set credential ${config.apiKeyEnv})`
				: `OpenCode GO: 未配置 API key(在 credential ${config.apiKeyEnv} 中设置)`);
		}
		return { usage: normalizeUsagePayload(await fetchUsage(config.baseUrl, key)) };
	};

	const quotaOnce = () => {
		const now = Date.now();
		const config = readConfig();
		const key = quotaCacheKey(config);
		if (quotaCache !== null && quotaCache.key === key && now - quotaCache.at < config.cacheMs) return quotaCache.promise;
		const promise = (async () => {
			if (config.quotaSource === "builtin") {
				const builtin = await readViaBuiltin(config);
				const { probe } = probeBase(ctx);
				return {
					...builtin,
					source: "builtin",
					requested: "builtin",
					// The numbers came from the built-in credential, so `account`
					// describes that ref; dsh-opencode-go's active account lives in
					// the separate `opencodeGo` detection block.
					account: { ref: config.apiKeyEnv, id: null, name: "" },
					fallback: null,
					opencodeGo: publicProbe(probe),
					lastSwitch: null
				};
			}

			const probe = await readViaOpencodeGo(ctx);
			if (probe.ok === true) {
				return {
					usage: probe.usage,
					source: "opencode-go",
					requested: "opencode-go",
					account: probe.account ?? null,
					fallback: null,
					opencodeGo: publicProbe(probe),
					lastSwitch: probe.lastSwitch ?? null
				};
			}

			let builtin;
			try {
				builtin = await readViaBuiltin(config);
			} catch (error) {
				const zh = config.locale !== "en";
				const builtinMessage = error instanceof Error ? error.message : String(error);
				const combined = new Error(zh
					? `OpenCode GO: 无法读取用量 — dsh-opencode-go: ${probe.message}; 内置提供商: ${builtinMessage}`
					: `OpenCode GO: could not read usage — dsh-opencode-go: ${probe.message}; built-in provider: ${builtinMessage}`);
				combined.details = {
					opencodeGo: publicProbe(probe),
					fallback: { from: "opencode-go", reason: probe.reason, message: probe.message }
				};
				throw combined;
			}
			return {
				...builtin,
				source: "builtin",
				requested: "opencode-go",
				// Served by the built-in path, so this is the credential ref that
				// actually produced the numbers.
				account: { ref: config.apiKeyEnv, id: null, name: "" },
				fallback: { from: "opencode-go", reason: probe.reason ?? "read-failed", message: probe.message ?? "" },
				opencodeGo: publicProbe(probe),
				lastSwitch: null
			};
		})();
		quotaCache = { at: now, key, promise };
		promise.catch(() => { if (quotaCache?.promise === promise) quotaCache = null; });
		return promise;
	};

	/** JSON response helper shared by the usage and settings routes. */
	const sendJson = (res, statusCode, body) => {
		res.statusCode = statusCode;
		res.setHeader("content-type", "application/json; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		res.end(JSON.stringify(body));
	};

	const handleUsage = async (_req, res) => {
		try {
			const config = readConfig();
			// Trigger a background refresh when the interval elapsed (never
			// block the response on the registry).
			void checkForUpdate(config).catch(() => {});
			const data = await quotaOnce();
			sendJson(res, 200, {
				...data,
				update: updateInfoOf(config),
				sessionHeader: { active: config.injectSessionHeader, count: sessionHeaderCount(), diag: sessionDiag() }
			});
		} catch (error) {
			const config = readConfig();
			sendJson(res, 502, {
				error: error instanceof Error ? error.message : String(error),
				requested: config.quotaSource,
				fallback: error?.details?.fallback ?? null,
				opencodeGo: error?.details?.opencodeGo ?? null
			});
		}
	};

	// ── settings page support ──────────────────────────────────────────────
	// DSH 2.x keys a plugin's settings page by its profile entry id and only
	// exposes volatile fields through `settings.describe()`. The custom page
	// in the Plugins panel persists through this route, so it works even when
	// the auto-generated "Plugin configuration" form is the only other view.
	const settingsServiceNow = () => {
		try {
			return typeof ctx.get === "function" ? ctx.get("settings") : null;
		} catch {
			return null;
		}
	};
	const settingsNamespaceNow = () => {
		try {
			const id = ctx?.fiber?.entry?.options?.id;
			if (typeof id === "string" && id.length > 0) return id;
		} catch {
			// a fiber with no owning entry falls back to the exported namespace
		}
		return namespace;
	};
	const settingsDescriptorNow = (settings, ns) => {
		try {
			return (settings.describe({ redactSecrets: true }) ?? []).find((entry) => entry.ns === ns) ?? null;
		} catch {
			return null;
		}
	};

	/** Non-network detection snapshot for the settings page and diagnostics. */
	const detectionPayload = () => {
		const config = readConfig();
		const { info, probe } = probeBase(ctx);
		const service = opencodeGoService(ctx);
		const opencodeGo = {
			...publicProbe(probe),
			service: service !== null,
			compatible: service !== null && info.found && info.enabled !== false,
			account: info.account,
			accounts: info.accounts
		};
		let effectiveSource = "builtin";
		let fallback = null;
		if (config.quotaSource === "opencode-go") {
			if (!info.found) {
				fallback = { from: "opencode-go", reason: "not-installed", message: "dsh-opencode-go is not installed, or its profile entry is inactive" };
			} else if (info.enabled === false) {
				fallback = { from: "opencode-go", reason: "entry-disabled", message: "dsh-opencode-go is installed but disabled in this profile" };
			} else if (service === null) {
				fallback = { from: "opencode-go", reason: "service-unavailable", message: "dsh-opencode-go does not expose the opencodeGoUsage service (unsupported version)" };
			} else {
				effectiveSource = "opencode-go";
			}
		}
		return { mode: config.quotaSource, effectiveSource, fallback, opencodeGo };
	};

	const readRequestBody = async (req) => {
		let body = "";
		for await (const chunk of req) {
			body += chunk;
			if (body.length > 64_000) throw new Error("request body too large");
		}
		return body;
	};

	/** Reject a cross-origin settings write (the usage route is read-only). */
	const sameOrigin = (req) => {
		const origin = req.headers?.origin;
		if (typeof origin !== "string" || origin.length === 0) return true;
		const port = ctx.webServer?.port;
		if (typeof port !== "number") return true;
		const host = ctx.webServer?.host;
		const allowed = new Set([
			`http://127.0.0.1:${port}`,
			`http://localhost:${port}`,
			`http://${host}:${port}`
		]);
		return allowed.has(origin);
	};

	const handleSettings = async (req, res) => {
		const method = req.method ?? "GET";
		if (method !== "GET" && method !== "POST") {
			res.statusCode = 405;
			res.end();
			return;
		}
		if (method === "POST" && !sameOrigin(req)) {
			sendJson(res, 403, { ok: false, error: "cross-origin request refused" });
			return;
		}
		const settings = settingsServiceNow();
		if (settings === null) {
			sendJson(res, 503, { ok: false, error: "the settings service is not available in this composition" });
			return;
		}
		const ns = settingsNamespaceNow();
		const descriptor = settingsDescriptorNow(settings, ns);
		if (descriptor === null) {
			sendJson(res, 503, {
				ok: false,
				namespace: ns,
				error: `settings namespace "${ns}" is not registered`,
				hint: "DSH derives this page from the plugin's exported Config; it must be active and declare at least one volatile field. Restart DSH after upgrading, and check that the profile entry id matches."
			});
			return;
		}
		if (method === "GET") {
			sendJson(res, 200, {
				ok: true,
				namespace: descriptor.ns,
				revision: descriptor.revision ?? 0,
				value: descriptor.value ?? {},
				base: descriptor.base ?? {},
				user: descriptor.user ?? {},
				detection: detectionPayload()
			});
			return;
		}

		let body;
		try {
			body = JSON.parse((await readRequestBody(req)) || "{}");
		} catch {
			sendJson(res, 400, { ok: false, error: "invalid JSON body" });
			return;
		}
		const patch = body !== null && typeof body === "object" && body.patch !== null && typeof body.patch === "object"
			? body.patch
			: undefined;
		if (patch === undefined) {
			sendJson(res, 400, { ok: false, error: "missing patch object" });
			return;
		}
		const quotaSource = patch.quotaSource;
		if (quotaSource !== "opencode-go" && quotaSource !== "builtin") {
			sendJson(res, 400, { ok: false, error: 'quotaSource must be "opencode-go" or "builtin"' });
			return;
		}
		try {
			await settings.update(ns, { quotaSource }, Number.isInteger(body.expectedRevision) ? body.expectedRevision : undefined);
			quotaCache = null;
			const next = settingsDescriptorNow(settings, ns);
			sendJson(res, 200, { ok: true, revision: next?.revision ?? 0, detection: detectionPayload() });
		} catch (error) {
			if (error?.code === "SETTINGS_CONFLICT" || error?.name === "SettingsConflictError") {
				sendJson(res, 409, {
					ok: false,
					conflict: true,
					currentRevision: error.actual,
					error: "设置已被其他会话修改，请重新加载后再保存。"
				});
				return;
			}
			sendJson(res, 400, { ok: false, error: String(error?.message ?? error).slice(0, 500) });
		}
	};

	// Same-origin routes the browser widget and settings page use. Registered
	// through `ctx.effect` so a live plugin reload (DSH's `patchReload: live`
	// HMR) disposes the previous registrations before the next apply. Direct
	// `webServer.register()` calls outlive the reload and the second apply then
	// fails with `webserver: duplicate exact route "/opencode-go/usage"`.
	ctx.effect(() => {
		const disposers = [
			ctx.webServer.register({
				kind: "exact",
				path: "/opencode-go/usage",
				handler: handleUsage
			}),
			ctx.webServer.register({
				kind: "exact",
				path: "/opencode-go/settings",
				handler: handleSettings
			})
		];
		return () => {
			for (const dispose of disposers) {
				if (typeof dispose === "function") dispose();
			}
		};
	}, "dsh-opencode-go-usage: routes");

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
