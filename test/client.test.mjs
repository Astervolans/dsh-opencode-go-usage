// Client-bundle contract: module-loader id, Plugins-panel registration key,
// the view boundary, and the exported components. The bundle is a plain
// factory, so a small window/react stub can load it without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadHost } from "./support/harness.mjs";

const host = await loadHost();
const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));

// ── browser shell stubs ────────────────────────────────────────────────────
const styleTags = [];
globalThis.document = {
	querySelector: () => null,
	createElement: () => ({ dataset: {}, textContent: "" }),
	head: { appendChild: (tag) => styleTags.push(tag) }
};

let captured = null;
globalThis.window = {
	__ModuleLoader__: {
		load: (entry) => { captured = entry; }
	}
};

/** Minimal hook implementation: enough to construct elements, no effects. */
function installHooks() {
	const states = [];
	let cursor = 0;
	return {
		useState(initial) {
			const index = cursor++;
			if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
			return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
		},
		useEffect() {},
		useRef(initial) { return { current: initial }; },
		useCallback(fn) { return fn; },
		Fragment: Symbol("Fragment")
	};
}

const react = installHooks();
const jsxRuntime = {
	jsx: (type, props, key) => ({ type, props: props ?? {}, key }),
	jsxs: (type, props, key) => ({ type, props: props ?? {}, key }),
	Fragment: react.Fragment
};

const code = readFileSync(path.resolve("lib/client.js"), "utf8");
const factory = new Function("window", "document", "require", code);
factory(globalThis.window, globalThis.document, (specifier) => {
	if (specifier === "react") return react;
	if (specifier === "react/jsx-runtime") return jsxRuntime;
	throw new Error(`unexpected require in client bundle: ${specifier}`);
});

test("the bundle registers under the package name", () => {
	assert.ok(captured !== null, "window.__ModuleLoader__.load was called");
	assert.equal(captured.id, pkg.name);
	assert.equal(typeof captured.factory, "function");
});

test("apply registers the sidebar widget and the Plugins-panel config page", () => {
	const registrations = [];
	const ctx = {
		effect: (fn) => { fn(); return () => {}; },
		locale: { register: () => () => {} },
		slots: {
			inject: (_name, callback) => { callback(); },
			register: (options, component) => {
				registrations.push({ options, component });
				return () => {};
			}
		}
	};
	const exports = captured.factory((specifier) => {
		if (specifier === "react") return react;
		if (specifier === "react/jsx-runtime") return jsxRuntime;
		throw new Error(specifier);
	});
	exports.apply(ctx);

	const widget = registrations.find((entry) => entry.options.name === "sidebar.footer.action");
	assert.ok(widget !== undefined, "sidebar.footer.action registered");
	assert.equal(widget.options.id, pkg.name);

	const config = registrations.find((entry) => entry.options.name === "plugins.bundle.config");
	assert.ok(config !== undefined, "plugins.bundle.config registered");
	assert.equal(config.options.key, pkg.name, "the config cell is keyed by the package name");
	assert.equal(config.options.locale, "dsh-opencode-go-usage");
});

test("summary view is a plain string; page view mounts the settings page", () => {
	const exports = captured.factory((specifier) => {
		if (specifier === "react") return react;
		if (specifier === "react/jsx-runtime") return jsxRuntime;
		throw new Error(specifier);
	});
	const summary = exports.BundleConfig({ view: "summary" });
	assert.equal(typeof summary, "string");
	assert.ok(summary.length > 0);

	const page = exports.BundleConfig({ view: "page" });
	assert.ok(page !== null && typeof page === "object", "page view returns an element");
	assert.equal(page.type, exports.SettingsPage);
});

test("top-level bundle code does not collide with another plugin's globals", () => {
	// The shell evaluates every client bundle as a classic script in one shared
	// global lexical scope. literature-search (and others) declare a top-level
	// `PACKAGE_NAME`; our bundle must keep its own names factory-local or it
	// makes the whole web boot fail with "Identifier has already been declared".
	const context = vm.createContext({
		window: { __ModuleLoader__: { load() {} } }
	});
	vm.runInContext('var PACKAGE_NAME = "@astervolans/dsh-literature-search"; var CONFIG_KEY = PACKAGE_NAME;', context);
	const code = readFileSync(path.resolve("lib/client.js"), "utf8");
	assert.doesNotThrow(
		() => vm.runInContext(code, context),
		"client bundle must not declare top-level lexical identifiers"
	);
});

test("host and client agree on the quotaSource values", () => {
	const text = readFileSync(path.resolve("lib/client.js"), "utf8");
	for (const source of host.QUOTA_SOURCES) {
		assert.ok(text.includes(`"${source}"`), `client mentions ${source}`);
	}
	assert.ok(text.includes("/opencode-go/settings"), "client calls the settings route");
	assert.ok(text.includes("plugins.bundle.config"), "client uses the official config slot");
});

test("usage polling retries transport failures but not HTTP answers", async () => {
	const exports = captured.factory((specifier) => {
		if (specifier === "react") return react;
		if (specifier === "react/jsx-runtime") return jsxRuntime;
		throw new Error(specifier);
	});
	const poll = exports.fetchUsageWithRetry;
	assert.equal(typeof poll, "function", "poll helper is exported for tests");

	// A local transport blip ("fetch failed", a reset keep-alive connection) is
	// retried and the next successful payload wins.
	let calls = 0;
	const waits = [];
	const recovered = await poll({
		request: async () => {
			calls += 1;
			if (calls < 3) throw new Error("fetch failed");
			return { ok: true, status: 200, json: async () => ({ usage: { monthly: { percent: 35 } } }) };
		},
		wait: async (ms) => { waits.push(ms); }
	});
	assert.equal(recovered.outcome, "ok");
	assert.equal(recovered.data.usage.monthly.percent, 35);
	assert.equal(calls, 3, "two transport failures were retried");
	assert.deepEqual(waits, [800, 2500], "retries use the documented backoff");

	// Once every retry failed the outcome is a network error, so the widget can
	// keep the last good payload instead of blanking.
	calls = 0;
	const failed = await poll({
		request: async () => { calls += 1; throw new Error("fetch failed"); },
		wait: async () => {}
	});
	assert.equal(failed.outcome, "network");
	assert.equal(failed.message, "fetch failed");
	assert.equal(calls, 3, "one attempt plus two retries");

	// HTTP answers are meaningful and must not be retried.
	calls = 0;
	const http = await poll({
		request: async () => {
			calls += 1;
			return { ok: false, status: 502, json: async () => ({ error: "gateway 502: upstream unavailable" }) };
		},
		wait: async () => {}
	});
	assert.equal(http.outcome, "http");
	assert.equal(http.message, "gateway 502: upstream unavailable");
	assert.equal(calls, 1, "HTTP failures are surfaced without retry");
});
