// GET /opencode-go/usage: source selection, fallback reasons and cache keys.
//
// Every request runs against a stub cordis context and a fake `globalThis.fetch`
// (see support/harness.mjs); no network, no real credentials.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	callRoute,
	credentials,
	goEntry,
	installWire,
	loadHost,
	makeCtx,
	usagePayload,
	usageService
} from "./support/harness.mjs";

const host = await loadHost();

/** dsh-opencode-go's flat service shape, with distinctive percentages. */
function flatUsage(percent = {}) {
	return {
		rolling: { status: "ok", percent: 71, resetsAt: "2026-10-30T06:00:00Z", ...(percent.rolling !== undefined ? { percent: percent.rolling } : {}) },
		weekly: { status: "ok", percent: 72, resetsAt: "2026-11-02T00:00:00Z", ...(percent.weekly !== undefined ? { percent: percent.weekly } : {}) },
		monthly: { status: "ok", percent: 73, resetsAt: "2026-11-15T00:00:00Z", ...(percent.monthly !== undefined ? { percent: percent.monthly } : {}) },
		lastSwitch: null
	};
}

/**
 * Boot one plugin instance and return its routes/config.
 * `cacheMs` is 0 unless the test is about caching.
 */
function boot({ config = {}, entries = [], service, credentialMap = {}, wire = {} } = {}) {
	const wireState = installWire(wire);
	const services = service === undefined ? {} : { opencodeGoUsage: service };
	const { ctx, routes } = makeCtx({ entries, services, credentialMap });
	const resolved = { cacheMs: 0, updateCheck: false, ...config };
	host.apply(ctx, resolved);
	return { wire: wireState, ctx, routes, config: resolved };
}

test("opencode-go source reads the active account through the service and reports no fallback", async () => {
	const service = usageService(() => flatUsage({ rolling: 11, monthly: 13 }));
	const { wire, routes } = boot({
		entries: [goEntry()],
		service,
		credentialMap: { OPENCODE_API_KEY: "sk-test" }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "opencode-go");
	assert.equal(res.body.requested, "opencode-go");
	assert.equal(res.body.fallback, null);
	assert.deepEqual(res.body.account, { ref: "OPENCODE_API_KEY", id: "legacy:OPENCODE_API_KEY", name: "mekki" });
	assert.equal(res.body.usage.rolling.percent, 11);
	assert.equal(res.body.usage.monthly.percent, 13);
	assert.equal(res.body.lastSwitch, null);
	assert.equal(res.body.opencodeGo.detected, true);
	assert.equal(res.body.opencodeGo.entryFound, true);
	assert.equal(res.body.opencodeGo.enabled, true);
	assert.equal(res.body.opencodeGo.service, true);
	assert.equal(res.body.opencodeGo.compatible, true);
	assert.equal(res.body.opencodeGo.reason, null);
	assert.equal(service.calls, 1);
	assert.equal(wire.requests.filter((request) => request.url.includes("/v1/usage")).length, 0, "the built-in gateway must not be called");
});

test("service absent (no loader entry) falls back to builtin with reason not-installed", async () => {
	const { wire, routes } = boot({
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" },
		wire: { usage: usagePayload({ monthly: { status: "ok", percent: 88, resetsAt: null } }) }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "builtin");
	assert.equal(res.body.requested, "opencode-go");
	assert.equal(res.body.fallback.from, "opencode-go");
	assert.equal(res.body.fallback.reason, "not-installed");
	assert.equal(typeof res.body.fallback.message, "string");
	assert.ok(res.body.fallback.message.length > 0);
	assert.equal(res.body.usage.monthly.percent, 88);
	assert.deepEqual(res.body.account, { ref: "OPENCODE_GO_API_KEY", id: null, name: "" }, "built-in mode reports the configured credential ref");
	assert.equal(res.body.opencodeGo.entryFound, false);
	assert.equal(wire.requests.filter((request) => request.url.includes("/v1/usage")).length, 1, "builtin gateway was used");
});

test("entry present but service missing falls back with reason service-unavailable", async () => {
	const { routes } = boot({
		entries: [goEntry()],
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "builtin");
	assert.equal(res.body.fallback.reason, "service-unavailable");
	assert.equal(res.body.opencodeGo.entryFound, true);
	assert.equal(res.body.opencodeGo.service, false);
	assert.deepEqual(res.body.account, { ref: "OPENCODE_GO_API_KEY", id: null, name: "" }, "the built-in path reports its own credential ref");
});

test("a disabled dsh-opencode-go entry falls back with reason entry-disabled", async () => {
	const { routes } = boot({
		entries: [goEntry({ enabled: false })],
		service: usageService(flatUsage()),
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "builtin");
	assert.equal(res.body.fallback.reason, "entry-disabled");
});

test("a loader-disabled dsh-opencode-go entry also reports entry-disabled", async () => {
	const disabledEntry = { ...goEntry(), disabled: true, fiber: null };
	const { routes } = boot({
		entries: [disabledEntry],
		service: usageService(flatUsage()),
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "builtin");
	assert.equal(res.body.fallback.reason, "entry-disabled");
	assert.equal(res.body.opencodeGo.entryFound, true);
	assert.equal(res.body.opencodeGo.enabled, false);
});

test("service.read() throwing falls back to builtin with read-failed and the error message", async () => {
	const service = usageService(() => {
		throw new Error("boom from read");
	});
	const { routes } = boot({
		entries: [goEntry()],
		service,
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "builtin");
	assert.equal(res.body.fallback.from, "opencode-go");
	assert.equal(res.body.fallback.reason, "read-failed");
	assert.ok(res.body.fallback.message.includes("boom from read"), `message was: ${res.body.fallback.message}`);
	assert.equal(res.body.opencodeGo.reason, "read-failed");
	assert.equal(res.body.opencodeGo.compatible, false);
	assert.equal(service.calls, 1);
});

test("an invalid service payload falls back with reason invalid-response", async () => {
	const service = usageService(() => ({ rolling: { percent: 1 } })); // no weekly/monthly
	const { routes } = boot({
		entries: [goEntry()],
		service,
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "builtin");
	assert.equal(res.body.fallback.reason, "invalid-response");
	assert.match(res.body.fallback.message, /weekly/);
});

test("quotaSource=builtin never reads the opencode-go service", async () => {
	const service = usageService(flatUsage());
	const { wire, routes } = boot({
		config: { quotaSource: "builtin" },
		entries: [goEntry()],
		service,
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" },
		wire: { usage: usagePayload({ monthly: { status: "ok", percent: 42, resetsAt: null } }) }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 200);
	assert.equal(res.body.source, "builtin");
	assert.equal(res.body.requested, "builtin");
	assert.equal(res.body.fallback, null);
	assert.equal(res.body.usage.monthly.percent, 42);
	assert.equal(res.body.account.ref, "OPENCODE_GO_API_KEY", "builtin mode reports the built-in credential ref");
	assert.equal(service.calls, 0, "the service must not be read when builtin is forced");
	const builtinCalls = wire.requests.filter((request) => request.url.includes("/v1/usage"));
	assert.equal(builtinCalls.length, 1);
	assert.equal(builtinCalls[0].headers.get("authorization"), "Bearer sk-test");
});

test("both sources failing returns 502 carrying both reasons", async () => {
	const service = usageService(() => {
		throw new Error("boom from read");
	});
	const { routes } = boot({
		entries: [goEntry()],
		service,
		credentialMap: {} // no builtin credential either
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 502);
	assert.equal(res.body.requested, "opencode-go");
	assert.ok(res.body.error.includes("boom from read"), `error was: ${res.body.error}`);
	assert.ok(res.body.error.includes("OPENCODE_GO_API_KEY"), `error was: ${res.body.error}`);
	assert.equal(res.body.fallback.from, "opencode-go");
	assert.equal(res.body.fallback.reason, "read-failed");
	assert.equal(res.body.fallback.message, "boom from read");
	assert.equal(res.body.opencodeGo.reason, "read-failed");
	assert.equal(res.body.opencodeGo.service, true);
});

test("builtin network failure also counts as a second failure for the 502 body", async () => {
	const service = usageService(() => {
		throw new Error("service down");
	});
	const { routes } = boot({
		entries: [goEntry()],
		service,
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" },
		wire: { usageError: new Error("gateway unreachable") }
	});

	const res = await callRoute(routes, "/opencode-go/usage");
	assert.equal(res.status, 502);
	assert.ok(res.body.error.includes("service down"));
	assert.ok(res.body.error.includes("gateway unreachable"));
});

test("cache: switching quotaSource does not serve the previous source's result", async () => {
	const service = usageService(() => flatUsage({ monthly: 71 }));
	const { routes, config } = boot({
		config: { cacheMs: 60_000, quotaSource: "opencode-go" },
		entries: [goEntry()],
		service,
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" },
		wire: { usage: usagePayload({ monthly: { status: "ok", percent: 99, resetsAt: null } }) }
	});

	const first = await callRoute(routes, "/opencode-go/usage");
	assert.equal(first.body.source, "opencode-go");
	assert.equal(first.body.usage.monthly.percent, 71);

	// Simulate the loader hot-applying the volatile quotaSource value.
	config.quotaSource = "builtin";
	const second = await callRoute(routes, "/opencode-go/usage");
	assert.equal(second.body.source, "builtin");
	assert.equal(second.body.usage.monthly.percent, 99);
	assert.equal(service.calls, 1, "the service was not re-read for the builtin response");
});

test("cache: switching the active account ref does not serve the previous account's result", async () => {
	const service = usageService((call) => flatUsage({ monthly: call === 1 ? 11 : 22 }));
	const entry = goEntry();
	const { routes } = boot({
		config: { cacheMs: 60_000 },
		entries: [entry],
		service,
		credentialMap: { OPENCODE_API_KEY: "sk-test" }
	});

	const first = await callRoute(routes, "/opencode-go/usage");
	assert.equal(first.body.account.ref, "OPENCODE_API_KEY");
	assert.equal(first.body.usage.monthly.percent, 11);

	// Simulate dsh-opencode-go auto-switching its active account.
	entry.fiber.config.apiKeyEnv = "SECOND_KEY";
	const second = await callRoute(routes, "/opencode-go/usage");
	assert.equal(second.body.account.ref, "SECOND_KEY");
	assert.equal(second.body.account.name, "backup");
	assert.equal(second.body.usage.monthly.percent, 22);
	assert.equal(service.calls, 2);
});

test("a 502 is not cached: the next request retries and succeeds once the service recovers", async () => {
	let attempt = 0;
	const service = usageService(() => {
		attempt += 1;
		if (attempt === 1) throw new Error("transient");
		return flatUsage({ monthly: 55 });
	});
	const credentialMap = {};
	const { routes } = boot({
		config: { cacheMs: 60_000 },
		entries: [goEntry()],
		service,
		credentialMap
	});

	const first = await callRoute(routes, "/opencode-go/usage");
	assert.equal(first.status, 502);
	assert.equal(service.calls, 1);

	// The operator fixes the missing builtin credential; the failed response
	// must not have been cached for the whole TTL.
	credentialMap.OPENCODE_GO_API_KEY = "sk-test";
	const second = await callRoute(routes, "/opencode-go/usage");
	assert.equal(second.status, 200);
	assert.equal(second.body.source, "opencode-go");
	assert.equal(second.body.usage.monthly.percent, 55);
	assert.equal(service.calls, 2);
});

test("a live reload disposes the previous routes before re-applying", () => {
	const service = usageService(flatUsage());
	const { ctx, routes, effects } = makeCtx({
		entries: [goEntry()],
		services: { opencodeGoUsage: service },
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" }
	});
	const config = { cacheMs: 0, updateCheck: false };

	host.apply(ctx, config);
	assert.equal(routes.length, 2, "both routes registered on the first apply");

	for (const dispose of effects) {
		if (typeof dispose === "function") dispose();
	}
	assert.equal(routes.length, 0, "the effect disposer removed both routes");

	host.apply(ctx, config);
	assert.equal(routes.length, 2, "the next apply registers exactly once (no duplicate route)");
});
