// Shared, hermetic harness for the host-half tests.
//
// Everything here is dependency-free Node: the real `lib/index.js` is imported
// through `support/loader.mjs` (which points the schemastery import at the DSH
// profile copy), and it runs against a stub cordis context and a fake
// `globalThis.fetch`, so no test touches the network or a real credential.
import { register } from "node:module";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

register("./loader.mjs", import.meta.url);

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path of the plugin repository root. */
export const REPO_ROOT = path.resolve(HARNESS_DIR, "..", "..");

/** Import the plugin's real host half (cached by the ESM loader). */
export async function loadHost() {
	return import(pathToFileURL(path.join(REPO_ROOT, "lib", "index.js")).href);
}

/** Read the real client bundle text. */
export async function readClientText() {
	const { readFileSync } = await import("node:fs");
	return readFileSync(path.join(REPO_ROOT, "lib", "client.js"), "utf8");
}

// ── fake wire ───────────────────────────────────────────────────────────────

/** JSON `Response` with the gateway's content type. */
export function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" }
	});
}

/** The canonical gateway usage payload (`{ usage: { rolling, weekly, monthly } }`). */
export function usagePayload(overrides = {}) {
	return {
		usage: {
			rolling: { status: "ok", percent: 12, resetsAt: "2026-08-14T07:51:13Z" },
			weekly: { status: "ok", percent: 34, resetsAt: "2026-08-17T00:00:00Z" },
			monthly: { status: "ok", percent: 56, resetsAt: "2026-08-21T13:05:13Z" },
			...overrides
		}
	};
}

/**
 * Install a hermetic `globalThis.fetch`.
 *
 * Answers the npm update check with an old version (so `update.available` is
 * always false) and `${base}/v1/usage` with the configured payload. Unknown
 * URLs throw: a test that reaches the network fails loudly.
 * @param {{ registry?: object, usage?: object, usageStatus?: number, usageError?: Error | null }} [options]
 */
export function installWire(options = {}) {
	const state = {
		registry: options.registry ?? { version: "0.0.1" },
		usage: options.usage ?? usagePayload(),
		usageStatus: options.usageStatus ?? 200,
		usageError: options.usageError ?? null
	};
	/** @type {Array<{ url: string, method: string, headers: Headers }>} */
	const requests = [];
	globalThis.fetch = async function testWire(input, init) {
		const url = String(input);
		const record = { url, method: init?.method ?? "GET", headers: new Headers(init?.headers) };
		requests.push(record);
		if (url.includes("registry.npmjs.org")) return jsonResponse(state.registry);
		if (url.includes("/v1/usage")) {
			if (state.usageError !== null) throw state.usageError;
			return jsonResponse(state.usage, state.usageStatus);
		}
		throw new Error(`unexpected fetch in hermetic test: ${url}`);
	};
	return { requests, state };
}

// ── stub cordis context ─────────────────────────────────────────────────────

/**
 * A dsh-opencode-go loader entry shaped like the real profile entry.
 * `fiber.config` holds plain values here; the host half also accepts live refs.
 */
export function goEntry(config = {}) {
	return {
		id: "opencode-go",
		options: { id: "opencode-go", name: "dsh-opencode-go" },
		disabled: false,
		fiber: {
			uid: 42,
			config: {
				enabled: true,
				apiKeyEnv: "OPENCODE_API_KEY",
				baseURL: "https://opencode.ai/zen/go",
				accounts: [
					{ id: "legacy:OPENCODE_API_KEY", name: "mekki", apiKeyEnv: "OPENCODE_API_KEY" },
					{ id: "legacy:SECOND_KEY", name: "backup", apiKeyEnv: "SECOND_KEY" }
				],
				...config
			}
		}
	};
}

/** A dsh-opencode-go usage service stub (`ctx.get("opencodeGoUsage")`). */
export function usageService(read) {
	const service = {
		calls: 0,
		async read() {
			service.calls += 1;
			return typeof read === "function" ? read(service.calls) : read;
		}
	};
	return service;
}

/** Credentials service stub backed by a `{ ref: value }` map. */
export function credentials(map = {}) {
	return {
		async resolve(ref) {
			if (!Object.prototype.hasOwnProperty.call(map, ref)) return undefined;
			return { value: map[ref] };
		}
	};
}

/**
 * Stub context with the surfaces `apply()` touches: web routes, commands,
 * credentials, event listeners, loader entries, `ctx.get()` services and the
 * fiber's own entry id.
 * @param {{
 *   entries?: object[],
 *   services?: Record<string, unknown>,
 *   credentialMap?: Record<string, string>,
 *   port?: number,
 *   host?: string,
 *   entryId?: string,
 * }} [options]
 */
export function makeCtx(options = {}) {
	const routes = [];
	const commands = [];
	const listeners = [];
	const effects = [];
	const services = { ...(options.services ?? {}) };
	const entries = options.entries ?? [];
	const ctx = {
		webServer: {
			port: options.port,
			host: options.host ?? "127.0.0.1",
			register(route) {
				if (routes.some((candidate) => candidate.kind === route.kind && candidate.path === route.path)) {
					throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`);
				}
				routes.push(route);
				return () => {
					const index = routes.indexOf(route);
					if (index !== -1) routes.splice(index, 1);
				};
			}
		},
		commands: {
			register(command) {
				commands.push(command);
				return () => {};
			}
		},
		credentials: credentials(options.credentialMap),
		effect(fn) {
			const dispose = fn();
			effects.push(dispose);
			return dispose;
		},
		on(name, callback) {
			listeners.push({ name, callback });
			return () => {};
		},
		loader: { entries: () => entries },
		get(name) {
			return services[name];
		},
		fiber: { entry: { options: { id: options.entryId ?? "dsh-opencode-go-usage" } } },
		root: {}
	};
	return { ctx, routes, commands, listeners, services, entries, effects };
}

/** Read-only response stub compatible with the plugin's `res.end()` usage. */
function responseStub() {
	return {
		statusCode: 200,
		headers: {},
		setHeader(key, value) {
			this.headers[String(key).toLowerCase()] = value;
		},
		end(chunk) {
			this.body = chunk === undefined ? "" : String(chunk);
		}
	};
}

/**
 * Invoke one registered route with a synthetic request.
 * @param {Array<{ path: string, handler: Function }>} routes
 * @param {string} routePath
 * @param {{ method?: string, headers?: Record<string, string>, body?: string }} [request]
 */
export async function callRoute(routes, routePath, request = {}) {
	const route = routes.find((candidate) => candidate.path === routePath);
	if (route === undefined) {
		throw new Error(`route not registered: ${routePath} (have: ${routes.map((entry) => entry.path).join(", ")})`);
	}
	const req = Readable.from(request.body === undefined ? [] : [Buffer.from(request.body, "utf8")]);
	req.method = request.method ?? "GET";
	req.headers = request.headers ?? {};
	const res = responseStub();
	await route.handler(req, res);
	let body = null;
	if (res.body.length > 0) {
		try {
			body = JSON.parse(res.body);
		} catch {
			body = null;
		}
	}
	return { status: res.statusCode, headers: res.headers, raw: res.body, body };
}

// ── fake settings service ───────────────────────────────────────────────────

/**
 * Stub of DSH's `settings` service as `lib/index.js` uses it:
 * `describe({ redactSecrets: true })` → descriptor array,
 * `update(ns, patch, expectedRevision)` → new redacted view.
 *
 * `onUpdate` simulates the loader hot-applying a volatile value (the real host
 * mutates the live config refs after a successful write), so a settings POST
 * is observable by the usage route immediately.
 * @param {{
 *   value?: Record<string, unknown>,
 *   revision?: number,
 *   onUpdate?: (patch: Record<string, unknown>, next: Record<string, unknown>) => void,
 * }} [options]
 */
export function makeSettings(options = {}) {
	let current = { ...(options.value ?? {}) };
	let revision = options.revision ?? 1;
	const updates = [];
	const describeCalls = [];
	const service = {
		updates,
		describeCalls,
		get revision() {
			return revision;
		},
		get value() {
			return { ...current };
		},
		describe(describeOptions) {
			describeCalls.push(describeOptions);
			return [{
				ns: "dsh-opencode-go-usage",
				autoGenerate: false,
				applies: "live",
				schema: {},
				secrets: [],
				revision,
				value: { ...current },
				base: { ...current },
				user: { ...current }
			}];
		},
		async update(ns, patch, expectedRevision) {
			updates.push({ ns, patch: { ...patch }, expectedRevision });
			if (expectedRevision !== undefined && expectedRevision !== revision) {
				const error = new Error("the settings entry was modified concurrently");
				error.name = "SettingsConflictError";
				error.code = "SETTINGS_CONFLICT";
				error.actual = revision;
				throw error;
			}
			current = { ...current, ...patch };
			revision += 1;
			options.onUpdate?.(patch, { ...current });
			return service.describe({ redactSecrets: true })[0];
		}
	};
	return service;
}
