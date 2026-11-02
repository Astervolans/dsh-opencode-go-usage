// Config schema coverage for the 1.6.0 `quotaSource` field.
//
// Uses the real exported `Config` and the loader's own validation entry point
// (`Config["~standard"].validate`), exactly like the smoke harness: this is the
// call the DSH loader performs before `apply()`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadHost } from "./support/harness.mjs";

const host = await loadHost();

/** Unwrap a cosmokit volatile ref when the local schemastery supports it. */
const unwrap = (value) => (value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value);

function validate(input) {
	const result = host.Config["~standard"].validate(input);
	assert.ok(result !== null && typeof result === "object", "Config validation returns a result object");
	return result;
}

test("quotaSource defaults to opencode-go when the config is empty", () => {
	const result = validate({});
	assert.ok(result.issues === undefined || result.issues.length === 0, `unexpected issues: ${JSON.stringify(result.issues)}`);
	assert.equal(unwrap(result.value.quotaSource), "opencode-go");
	assert.equal(unwrap(result.value.apiKeyEnv), "OPENCODE_GO_API_KEY");
	assert.equal(unwrap(result.value.baseUrl), "https://opencode.ai/zen/go");
	assert.equal(unwrap(result.value.cacheMs), 30000);
});

test("quotaSource accepts the builtin value", () => {
	const result = validate({ quotaSource: "builtin" });
	assert.ok(result.issues === undefined || result.issues.length === 0, `unexpected issues: ${JSON.stringify(result.issues)}`);
	assert.equal(unwrap(result.value.quotaSource), "builtin");
});

test("quotaSource rejects an unknown value", () => {
	const result = validate({ quotaSource: "somewhere-else" });
	assert.ok(Array.isArray(result.issues) && result.issues.length > 0, "an invalid quotaSource must produce validation issues");
});

test("QUOTA_SOURCES and normalizeQuotaSource match the contract", () => {
	assert.deepEqual(host.QUOTA_SOURCES, ["opencode-go", "builtin"]);
	assert.equal(host.DEFAULT_QUOTA_SOURCE, "opencode-go");
	assert.equal(host.normalizeQuotaSource("opencode-go"), "opencode-go");
	assert.equal(host.normalizeQuotaSource("builtin"), "builtin");
	assert.equal(host.normalizeQuotaSource("nope"), "opencode-go");
	assert.equal(host.normalizeQuotaSource(undefined), "opencode-go");
});
