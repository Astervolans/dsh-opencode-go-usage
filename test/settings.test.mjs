// GET/POST /opencode-go/settings: descriptor passthrough, detection payload,
// revision conflicts, write whitelist and cache invalidation.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	callRoute,
	goEntry,
	installWire,
	loadHost,
	makeCtx,
	makeSettings,
	usagePayload,
	usageService
} from "./support/harness.mjs";

const host = await loadHost();

function flatUsage(monthly) {
	return {
		rolling: { status: "ok", percent: 10, resetsAt: null },
		weekly: { status: "ok", percent: 20, resetsAt: null },
		monthly: { status: "ok", percent: monthly, resetsAt: null }
	};
}

/** Boot one plugin instance with a fake settings service (+ optional usage service). */
function boot({ config = {}, entries = [], service, settings, wire = {}, port } = {}) {
	const wireState = installWire(wire);
	const services = {};
	if (settings !== undefined) services.settings = settings;
	if (service !== undefined) services.opencodeGoUsage = service;
	const { ctx, routes } = makeCtx({
		entries,
		services,
		credentialMap: { OPENCODE_GO_API_KEY: "sk-test" },
		port
	});
	// Keep the caller's object identity: `onUpdate` simulates the host mutating
	// the live config refs, and `apply()` reads that same object.
	const resolved = config;
	if (resolved.cacheMs === undefined) resolved.cacheMs = 0;
	if (resolved.updateCheck === undefined) resolved.updateCheck = false;
	host.apply(ctx, resolved);
	return { wire: wireState, ctx, routes, config: resolved };
}

/** Common setup: one active entry, one usage service, one settings descriptor. */
function standard(overrides = {}) {
	const entry = overrides.entry ?? goEntry();
	const service = overrides.service ?? usageService(() => flatUsage(33));
	const config = { quotaSource: "opencode-go", ...(overrides.config ?? {}) };
	const settings = overrides.settings ?? makeSettings({
		value: { quotaSource: config.quotaSource },
		revision: 7,
		onUpdate: overrides.onUpdate
	});
	const booted = boot({ entries: [entry], service, settings, config, wire: overrides.wire, port: overrides.port });
	return { ...booted, entry, service, settings };
}

test("GET settings returns the descriptor value, revision and detection", async () => {
	const { routes } = standard();
	const res = await callRoute(routes, "/opencode-go/settings");

	assert.equal(res.status, 200);
	assert.equal(res.body.ok, true);
	assert.equal(res.body.namespace, "dsh-opencode-go-usage");
	assert.equal(res.body.revision, 7);
	assert.equal(res.body.value.quotaSource, "opencode-go");
	assert.equal(res.body.base.quotaSource, "opencode-go");
	assert.equal(res.body.user.quotaSource, "opencode-go");

	const detection = res.body.detection;
	assert.equal(detection.mode, "opencode-go");
	assert.equal(detection.effectiveSource, "opencode-go");
	assert.equal(detection.fallback, null);
	assert.equal(detection.opencodeGo.detected, true);
	assert.equal(detection.opencodeGo.entryFound, true);
	assert.equal(detection.opencodeGo.enabled, true);
	assert.equal(detection.opencodeGo.service, true);
	assert.equal(detection.opencodeGo.compatible, true);
	assert.deepEqual(detection.opencodeGo.account, {
		ref: "OPENCODE_API_KEY",
		id: "legacy:OPENCODE_API_KEY",
		name: "mekki"
	});
	assert.deepEqual(detection.opencodeGo.accounts, [
		{ ref: "OPENCODE_API_KEY", name: "mekki" },
		{ ref: "SECOND_KEY", name: "backup" }
	]);
});

test("GET settings reports the fallback when dsh-opencode-go is absent", async () => {
	const settings = makeSettings({ value: { quotaSource: "opencode-go" }, revision: 3 });
	const { routes } = boot({ entries: [], settings, config: { quotaSource: "opencode-go" } });

	const res = await callRoute(routes, "/opencode-go/settings");
	assert.equal(res.status, 200);
	assert.equal(res.body.detection.mode, "opencode-go");
	assert.equal(res.body.detection.effectiveSource, "builtin");
	assert.equal(res.body.detection.fallback.from, "opencode-go");
	assert.equal(res.body.detection.fallback.reason, "not-installed");
	assert.equal(res.body.detection.opencodeGo.entryFound, false);
});

test("GET settings returns 503 when the settings service is absent or the namespace is unregistered", async () => {
	const absent = boot({ entries: [], config: { quotaSource: "opencode-go" } });
	const noService = await callRoute(absent.routes, "/opencode-go/settings");
	assert.equal(noService.status, 503);
	assert.equal(noService.body.ok, false);

	const emptySettings = { describe: () => [], update: async () => {} };
	const noNamespace = boot({ entries: [], settings: emptySettings, config: { quotaSource: "opencode-go" } });
	const noDescriptor = await callRoute(noNamespace.routes, "/opencode-go/settings");
	assert.equal(noDescriptor.status, 503);
	assert.ok(String(noDescriptor.body.hint).length > 0, "503 carries a hint about the entry id / schemastery");
});

test("POST settings writes only quotaSource and answers with the new revision", async () => {
	const settings = makeSettings({
		value: { quotaSource: "opencode-go", apiKeyEnv: "OPENCODE_GO_API_KEY" },
		revision: 7,
		onUpdate: (patch, next) => {
			if (patch.quotaSource !== undefined) config.quotaSource = next.quotaSource;
		}
	});
	const config = { quotaSource: "opencode-go" };
	const { routes } = boot({ entries: [goEntry()], service: usageService(() => flatUsage(33)), settings, config });

	const res = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ patch: { quotaSource: "builtin" }, expectedRevision: 7 })
	});

	assert.equal(res.status, 200);
	assert.equal(res.body.ok, true);
	assert.equal(res.body.revision, 8);
	assert.equal(res.body.detection.mode, "builtin");
	assert.equal(res.body.detection.opencodeGo.entryFound, true);
	assert.equal(settings.updates.length, 1);
	assert.equal(settings.updates[0].ns, "dsh-opencode-go-usage");
	assert.equal(settings.updates[0].expectedRevision, 7);
	assert.deepEqual(settings.updates[0].patch, { quotaSource: "builtin" });
	assert.equal(config.quotaSource, "builtin", "the simulated volatile config was updated");
});

test("POST settings ignores extra patch keys (only quotaSource is forwarded)", async () => {
	const settings = makeSettings({ value: { quotaSource: "opencode-go" }, revision: 2 });
	const { routes } = boot({ entries: [goEntry()], settings, config: { quotaSource: "opencode-go" } });

	const res = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			patch: { quotaSource: "builtin", apiKeyEnv: "HACKED", baseUrl: "https://evil.example" },
			expectedRevision: 2
		})
	});

	assert.equal(res.status, 200);
	assert.deepEqual(settings.updates[0].patch, { quotaSource: "builtin" });
	assert.equal(settings.value.apiKeyEnv, undefined, "extra keys must not reach the settings service");
});

test("POST settings rejects a stale expectedRevision with 409", async () => {
	const settings = makeSettings({ value: { quotaSource: "opencode-go" }, revision: 7 });
	const { routes } = boot({ entries: [goEntry()], settings, config: { quotaSource: "opencode-go" } });

	const res = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ patch: { quotaSource: "builtin" }, expectedRevision: 6 })
	});

	assert.equal(res.status, 409);
	assert.equal(res.body.ok, false);
	assert.equal(res.body.conflict, true);
	assert.equal(res.body.currentRevision, 7);
	assert.equal(settings.value.quotaSource, "opencode-go", "the rejected write changed nothing");
});

test("POST settings rejects an invalid quotaSource with 400", async () => {
	const settings = makeSettings({ value: { quotaSource: "opencode-go" }, revision: 7 });
	const { routes } = boot({ entries: [goEntry()], settings, config: { quotaSource: "opencode-go" } });

	const res = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ patch: { quotaSource: "nope" }, expectedRevision: 7 })
	});

	assert.equal(res.status, 400);
	assert.equal(res.body.ok, false);
	assert.equal(settings.updates.length, 0);
});

test("POST settings rejects malformed bodies with 400", async () => {
	const settings = makeSettings({ value: { quotaSource: "opencode-go" }, revision: 7 });
	const { routes } = boot({ entries: [goEntry()], settings, config: { quotaSource: "opencode-go" } });

	const invalidJson = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: "{not json"
	});
	assert.equal(invalidJson.status, 400);

	const missingPatch = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ expectedRevision: 7 })
	});
	assert.equal(missingPatch.status, 400);
	assert.equal(settings.updates.length, 0);
});

test("POST settings refuses a cross-origin write with 403 but accepts same-origin", async () => {
	const settings = makeSettings({ value: { quotaSource: "opencode-go" }, revision: 1 });
	const { routes } = boot({
		entries: [goEntry()],
		settings,
		config: { quotaSource: "opencode-go" },
		port: 12999
	});

	const crossOrigin = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json", origin: "http://evil.example" },
		body: JSON.stringify({ patch: { quotaSource: "builtin" }, expectedRevision: 1 })
	});
	assert.equal(crossOrigin.status, 403);
	assert.equal(settings.updates.length, 0);

	const sameOrigin = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json", origin: "http://127.0.0.1:12999" },
		body: JSON.stringify({ patch: { quotaSource: "builtin" }, expectedRevision: 1 })
	});
	assert.equal(sameOrigin.status, 200);
});

test("unsupported methods on /opencode-go/settings return 405", async () => {
	const { routes } = standard();
	const res = await callRoute(routes, "/opencode-go/settings", { method: "DELETE" });
	assert.equal(res.status, 405);
});

test("a settings write invalidates the usage cache", async () => {
	const service = usageService(() => flatUsage(71));
	const config = { quotaSource: "opencode-go", cacheMs: 60_000 };
	const settings = makeSettings({
		value: { quotaSource: "opencode-go" },
		revision: 4,
		onUpdate: (patch, next) => {
			if (patch.quotaSource !== undefined) config.quotaSource = next.quotaSource;
		}
	});
	const { routes } = boot({
		entries: [goEntry()],
		service,
		settings,
		config,
		wire: { usage: usagePayload({ monthly: { status: "ok", percent: 99, resetsAt: null } }) }
	});

	const primed = await callRoute(routes, "/opencode-go/usage");
	assert.equal(primed.body.source, "opencode-go");
	assert.equal(primed.body.usage.monthly.percent, 71);

	const write = await callRoute(routes, "/opencode-go/settings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ patch: { quotaSource: "builtin" }, expectedRevision: 4 })
	});
	assert.equal(write.status, 200);

	const after = await callRoute(routes, "/opencode-go/usage");
	assert.equal(after.body.source, "builtin");
	assert.equal(after.body.requested, "builtin");
	assert.equal(after.body.usage.monthly.percent, 99);
	assert.equal(service.calls, 1, "the cached opencode-go result was not reused");
});
