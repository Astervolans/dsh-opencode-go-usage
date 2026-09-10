// @ts-check
/**
 * dsh-opencode-go-usage — runtime `x-opencode-session` injection (host half).
 *
 * WHY: the OpenCode GO gateway rejects chat-completion requests that lack the
 * `x-opencode-session` header with HTTP 400 `{"type":"MissingSessionID"}`,
 * and DSH's `llm-pi-ai` adapter never sends it (pi-ai's session-affinity
 * headers are `session_id` / `x-client-request-id` / `x-session-affinity`, and
 * off by default). Instead of patching DSH's installed files (wiped by every
 * DSH upgrade), this module injects the header at runtime:
 *
 *   1. `patchFetch()` wraps `globalThis.fetch` once. A request gets
 *      `x-opencode-session` added only when the AsyncLocalStorage context
 *      carries a session AND the request URL starts with that call's gateway
 *      base (see 2) — the base always comes from the called provider's own
 *      settings, never from a hard-coded host list.
 *   2. `withSession()` runs a stream inside that context. Standing on DSH's
 *      official `llm/stream` waterfall event, the plugin captures the per-call
 *      `options.sessionId` (`dsh-agent-loop` fills it with `session.id`) and
 *      resolves the wire base from `llm-pi-ai.providers.<route>.baseURL`, then
 *      wraps the stream iterator so the wire fetch issued while the adapter
 *      pulls chunks sees both values. AsyncLocalStorage propagation through
 *      async-generator bodies and their await chains is verified.
 *
 * The header value is the real per-conversation harness session id — never a
 * fixed fake — and only requests to the configured gateway base of the call
 * being streamed ever receive it. No private host names live in the code.
 */

import { AsyncLocalStorage } from "node:async_hooks";

/** Marks `globalThis.fetch` as already wrapped by this module (HMR-safe). */
const FETCH_WRAPPED = Symbol.for("dsh-opencode-go-usage:fetch-wrapped");

/**
 * Per-process AsyncLocalStorage bridging the LLM call to the wire fetch.
 * Store shape: `{ sessionId: string, base: string }` — the per-call harness
 * session id and the gateway base resolved from that provider's settings.
 */
const sessionStore = new AsyncLocalStorage();

/** How many GO gateway requests actually received the session header. */
let injectionCount = 0;

/**
 * Runtime observability for the injection feature, so a deployment that does
 * not inject can be told *where* the chain stopped: the waterfall handler
 * records every `llm/stream` it sees (`streamSeen` + the last stream's
 * provider / session-id presence / base source), the fetch wrapper counts
 * wire calls that carried the context (`requests`) and how many of them got
 * the header (`injected`, same as {@link sessionHeaderCount}) or fell through
 * because the URL did not match that call's base (`missed`).
 */
const diag = {
	streamSeen: 0,
	/** @type {{ at: number, provider: string | null, hasSessionId: boolean, base: string | null, baseFrom: "settings" | "config" | null } | null} */
	lastStream: null,
	requests: 0,
	injected: 0,
	missed: 0
};

/**
 * @returns {number} count of requests that got `x-opencode-session`.
 */
export function sessionHeaderCount() {
	return injectionCount;
}

/**
 * Record one `llm/stream` observation (see the `diag` object above).
 * @param {Pick<NonNullable<typeof diag.lastStream>, "provider" | "hasSessionId" | "base" | "baseFrom">} info
 */
export function recordStream(info) {
	diag.streamSeen += 1;
	diag.lastStream = { at: Date.now(), ...info };
}

/**
 * Snapshot of the runtime diagnostics (safe for JSON responses).
 * @returns {{ streamSeen: number, lastStream: unknown, requests: number, injected: number, missed: number }}
 */
export function sessionDiag() {
	return { ...diag, lastStream: diag.lastStream === null ? null : { ...diag.lastStream } };
}

/**
 * Wrap `globalThis.fetch` once. Requests whose URL starts with the gateway
 * base carried in the ALS context get `x-opencode-session` added (their
 * session id comes from the same context). Idempotent: re-installing
 * (HMR / re-apply) never double-wraps.
 */
export function patchFetch() {
	if (globalThis[FETCH_WRAPPED]) return;
	const nativeFetch = globalThis.fetch;
	globalThis[FETCH_WRAPPED] = true;
	globalThis.fetch = function sessionFetch(input, init) {
		const meta = sessionStore.getStore();
		if (meta?.sessionId !== undefined) {
			if (matchesBase(input, meta.base)) {
				const headers = new Headers(init?.headers);
				if (!headers.has("x-opencode-session")) {
					headers.set("x-opencode-session", String(meta.sessionId));
					injectionCount += 1;
				}
				init = { ...init, headers };
				diag.injected += 1;
			} else {
				diag.missed += 1;
			}
			diag.requests += 1;
		}
		return nativeFetch.call(this, input, init);
	};
}

/**
 * True when the request URL targets the given gateway base (trailing slashes
 * ignored; the base itself or `base/...` both match).
 * @param {RequestInfo | URL} input
 * @param {string} base - gateway base from provider settings, e.g.
 *   `https://opencode.ai/zen/go/v1`.
 */
function matchesBase(input, base) {
	const url = String(input);
	const b = String(base ?? "").replace(/\/+$/, "");
	return b.length > 0 && (url === b || url.startsWith(b + "/"));
}

/**
 * Run a stream's iteration inside the given session context, so async work
 * created while the adapter pulls chunks (including the pi-ai wire fetch)
 * resolves the context from the ALS store. Implements the async-iterator
 * protocol so `for await` and direct `.next()` both work.
 * @template T
 * @param {AsyncIterable<T>} stream
 * @param {{ sessionId: string, base: string }} meta
 * @returns {AsyncIterable<T>}
 */
export function withSession(stream, meta) {
	const iterator = stream[Symbol.asyncIterator]();
	const run = (method, args) => {
		const fn = iterator[method];
		if (typeof fn !== "function") {
			return Promise.resolve(method === "throw" ? { done: true } : void 0);
		}
		return sessionStore.run(meta, () => Promise.resolve(fn.call(iterator, ...args)));
	};
	return {
		[Symbol.asyncIterator]() { return this; },
		next: (...args) => run("next", args),
		return: (...args) => run("return", args),
		throw: (...args) => run("throw", args)
	};
}