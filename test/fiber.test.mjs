// Registration lifecycle: a loader restart must dispose the previous fiber's
// routes/command, and a host already broken by a pre-fix instance must heal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { goEntry, installWire, loadHost, makeCtx, usageService } from "./support/harness.mjs";

const host = await loadHost();

const flatUsage = () => ({
	rolling: { status: "ok", percent: 10, resetsAt: null },
	weekly: { status: "ok", percent: 20, resetsAt: null },
	monthly: { status: "ok", percent: 30, resetsAt: null }
});

const boot = () => {
	installWire();
	const service = usageService(flatUsage);
	return {
		service,
		...makeCtx({
			entries: [goEntry()],
			services: { opencodeGoUsage: service },
			credentialMap: { OPENCODE_GO_API_KEY: "sk-test" }
		})
	};
};

test("a route leaked by a pre-fix instance is taken over on apply", () => {
	const { ctx, routes, exact } = boot();
	const stale = { kind: "exact", path: "/opencode-go/usage", handler: () => {} };
	exact.set("/opencode-go/usage", stale);

	host.apply(ctx, { cacheMs: 0, updateCheck: false });

	assert.equal(routes.length, 2, "both routes are registered");
	assert.notEqual(exact.get("/opencode-go/usage"), stale, "the stale row was replaced");
	assert.equal(typeof exact.get("/opencode-go/usage").handler, "function");
});

test("a command leaked by a pre-fix instance only warns; the widget routes still register", () => {
	const { ctx, routes, warns, commandMap } = boot();
	// 1.5.0 registered the command without a fiber-owned effect; simulate the
	// stale row the replacement fiber then hits.
	ctx.commands.register({
		name: "opencode-go",
		description: "stale 1.5.0 command",
		handler: async () => ({ kind: "success", text: "stale" })
	});

	assert.doesNotThrow(() => host.apply(ctx, { cacheMs: 0, updateCheck: false }));
	assert.equal(routes.length, 2, "both routes registered despite the command conflict");
	assert.equal(commandMap.size, 1, "the leaked command is still the only one");
	assert.ok(warns.some((message) => /opencode-go/.test(message)), "the conflict is reported as a warning");
});

test("disposing the fiber removes the routes and the command", () => {
	const { ctx, routes, commands, effects } = boot();
	host.apply(ctx, { cacheMs: 0, updateCheck: false });
	assert.equal(routes.length, 2);
	assert.equal(commands.length, 1);

	for (const dispose of effects) {
		if (typeof dispose === "function") dispose();
	}
	assert.equal(routes.length, 0, "routes disposed with the fiber");
	assert.equal(commands.length, 0, "command disposed with the fiber");
});
