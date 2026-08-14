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
 * - Browser bundle self-hosted at `/dsh-opencode-go-usage/client.js` with its boot
 *   graph row injected through the official `webServer.tapIndex` API, so the
 *   sidebar widget works from any installation location.
 *
 * Installation / configuration (official DSH flows):
 *   - Install: `dsh plugin --profile web add dsh-opencode-go-usage` — the
 *     `dsh.bundle.patch` declaration makes the CLI reconcile this package into
 *     the profile's bundle layer stack automatically (no manual patch edits).
 *   - Configure: the `dsh-opencode-go-usage` settings namespace (Web Settings →
 *     Plugins → Plugin configuration, or `~/.dsh/settings.yaml`). The API key
 *     itself lives in the credentials domain (`OPENCODE_GO_API_KEY`), never in
 *     settings.
 *
 * Settings namespace `dsh-opencode-go-usage`:
 *   - apiKeyEnv:    credential ref / env var for the API key (default OPENCODE_GO_API_KEY)
 *   - baseUrl:      GO gateway base (default https://opencode.ai/zen/go)
 *   - cacheMs:      host-side cache TTL (default 30000)
 *   - updateCheck:  check npm for newer versions (default true); result shows
 *                   in the widget and the command — the plugin never installs
 *                   itself, upgrading stays an explicit user action.
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import z from "@deepseek-ai/schemastery";

export const name = "dsh-opencode-go-usage";

/** Required services: web routes, chat commands, credentials, settings. */
export const inject = ["webServer", "commands", "credentials", "settings"];

/** Settings namespace owned by this plugin. */
export const namespace = "dsh-opencode-go-usage";

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go";
const DEFAULT_API_KEY_ENV = "OPENCODE_GO_API_KEY";
const DEFAULT_CACHE_MS = 30_000;
/** npm package name this plugin is published under (update checks). */
const NPM_PACKAGE = "dsh-opencode-go-usage";
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

/** Settings schema for this plugin's namespace. */
export const Config = z.object({
	apiKeyEnv: z.string().default(DEFAULT_API_KEY_ENV),
	baseUrl: z.string().default(DEFAULT_BASE_URL),
	cacheMs: z.number().default(DEFAULT_CACHE_MS),
	updateCheck: z.boolean().default(true)
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

/** Short content hash used as the bundle revision. */
function shortHash(input) {
	return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

/**
 * Inject one graph row into the index.html boot manifest
 * (`window.__DSH_BOOT__ = [...]`), skipping when the id is already present.
 * @param {string} html
 * @param {{ id: string, url: string, rev: string, inject?: string[], immediately?: boolean }} row
 * @returns the transformed html.
 */
function injectGraphRow(html, row) {
	const marker = "window.__DSH_BOOT__ = ";
	const start = html.indexOf(marker);
	if (start === -1) return html;
	const bodyStart = start + marker.length;
	const end = html.indexOf("</script>", bodyStart);
	if (end === -1) return html;
	let graph;
	try {
		graph = JSON.parse(html.slice(bodyStart, end).trim());
	} catch {
		return html;
	}
	if (!Array.isArray(graph)) return html;
	if (graph.some((entry) => entry !== null && typeof entry === "object" && entry.id === row.id)) return html;
	graph.push(row);
	// Keep the same escaping client-modules uses so the payload cannot break
	// out of the script element.
	return html.slice(0, bodyStart) + JSON.stringify(graph).replaceAll("<", "\\u003c") + html.slice(end);
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, unknown>} rawConfig - loader entry config (becomes the settings `base` layer).
 */
export function apply(ctx, rawConfig = {}) {
	// Register the settings namespace. The loader entry config (rawConfig) is
	// handed to the settings seam as `base`, so a legacy manual patch keeps
	// working while the user document (settings.yaml / Web UI) wins over it.
	ctx.settings.register(namespace, Config, { base: rawConfig });

	const readConfig = () => {
		const stored = ctx.settings.get(namespace) ?? {};
		// DSH's own locale preference ("locale.preference": zh | en); absent
		// falls back to zh (the browser decides when the user never picked).
		const locale = ctx.settings.get("locale")?.preference ?? "zh";
		return {
			apiKeyEnv: stored.apiKeyEnv,
			baseUrl: stored.baseUrl,
			cacheMs: stored.cacheMs,
			updateCheck: stored.updateCheck !== false,
			locale
		};
	};

	// ── update check (npm) ─────────────────────────────────────────────────
	// Checks the registry at most once per UPDATE_CHECK_INTERVAL_MS; failures
	// are silent. The plugin only reports — upgrading stays a user action
	// (`dsh plugin --profile web add dsh-opencode-go-usage@latest`).
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
			res.end(JSON.stringify({ ...data, update: updateInfoOf(config) }));
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

	// ── self-host the browser bundle ───────────────────────────────────────
	// client-modules can only resolve packages reachable from DSH's own
	// installation; a profile-installed third-party package would lose its
	// browser half. Instead we serve the bundle ourselves and inject its boot
	// graph row through the official index-tap API, so the sidebar widget
	// works from any installation location.
	const bundlePath = new URL("./client.js", import.meta.url);
	let bundleBytes = null;
	try {
		bundleBytes = readFileSync(bundlePath);
	} catch {
		// Package installed without lib/client.js — widget unavailable; the
		// route and command above still work.
	}
	if (bundleBytes !== null) {
		const rev = shortHash(bundleBytes);
		ctx.webServer.register({
			kind: "exact",
			path: "/dsh-opencode-go-usage/client.js",
			handler: async (_req, res) => {
				res.setHeader("content-type", "text/javascript; charset=utf-8");
				res.setHeader("cache-control", "no-cache");
				res.end(bundleBytes);
			}
		});
		ctx.webServer.tapIndex((html) => injectGraphRow(html, {
			id: "dsh-opencode-go-usage",
			url: `/dsh-opencode-go-usage/client.js?rev=${rev}`,
			rev,
			inject: ["@deepseek-ai/dsh-client-runtime"],
			immediately: true
		}));
	}

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
