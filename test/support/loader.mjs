// Test loader: resolves the bare `@deepseek-ai/schemastery` specifier used by
// `lib/index.js` to the copy that ships with the local DSH profile.
//
// The plugin repo deliberately has no `node_modules` of its own, but the host
// half imports schemastery (the loader owns the schema). These tests import
// the REAL `lib/index.js` and run the REAL schema validation without adding a
// dependency: this resolve hook points at an existing installation.
//
// Resolution order:
//   1. `OCG_SCHEMASTERY` — absolute path to a `lib/index.mjs` (explicit override)
//   2. `$DSH_HOME/profiles/desktop/node_modules/...` (when `DSH_HOME` is set)
//   3. `~/.dsh/profiles/desktop/node_modules/...` (the regular desktop profile)
//   4. `.verify-e2e/home/profiles/e2e/...` (the isolated verification profile)
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Every candidate path, in probe order (also used in the error message). */
function candidateEntries() {
	const entries = [];
	if (process.env.OCG_SCHEMASTERY) entries.push(path.resolve(process.env.OCG_SCHEMASTERY));
	const profiles = [];
	if (process.env.DSH_HOME) profiles.push(path.join(process.env.DSH_HOME, "profiles", "desktop"));
	profiles.push(path.join(homedir(), ".dsh", "profiles", "desktop"));
	profiles.push(path.join(process.cwd(), ".verify-e2e", "home", "profiles", "e2e"));
	for (const profile of profiles) {
		entries.push(path.join(profile, "node_modules", "@deepseek-ai", "schemastery", "lib", "index.mjs"));
	}
	return entries;
}

let cachedUrl = null;

function schemasteryUrl() {
	if (cachedUrl !== null) return cachedUrl;
	const tried = candidateEntries();
	for (const entry of tried) {
		if (existsSync(entry)) {
			cachedUrl = pathToFileURL(entry).href;
			return cachedUrl;
		}
	}
	throw new Error(
		"@deepseek-ai/schemastery was not found for the offline tests. Looked in:\n  "
		+ tried.join("\n  ")
		+ "\nSet OCG_SCHEMASTERY to an existing schemastery/lib/index.mjs to override."
	);
}

/** @type {import("node:module").ResolveHook} */
export async function resolve(specifier, context, nextResolve) {
	if (specifier === "@deepseek-ai/schemastery") {
		return { url: schemasteryUrl(), shortCircuit: true };
	}
	return nextResolve(specifier, context);
}
