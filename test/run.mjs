// Single-process test runner.
//
// `node --test test/` spawns one child per file; some Windows sandboxes deny
// that spawn (EPERM). Importing the files in one process registers every
// `node:test` case and runs them without spawning.
import "./config.test.mjs";
import "./usage.test.mjs";
import "./settings.test.mjs";
import "./client.test.mjs";
