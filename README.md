# @astervolans/dsh-opencode-go-usage

English | [中文](README.zh.md)

> ⚡ Get an **OpenCode GO plan**: [buycodingplan.com](https://buycodingplan.com/)

> **This is a fork of [yumusb/dsh-opencode-go-usage](https://github.com/yumusb/dsh-opencode-go-usage)**
> ([Astervolans/dsh-opencode-go-usage](https://github.com/Astervolans/dsh-opencode-go-usage)),
> published as the scoped package `@astervolans/dsh-opencode-go-usage`. The difference from
> upstream: **a time bar under each usage bar** (see Features). The settings namespace, HTTP
> routes and command name are still `dsh-opencode-go-usage` (unchanged), so migrating from
> upstream needs no configuration changes; only the `dsh.bundle.patch` entry's `name` must be the
> resolvable scoped package name, or `dsh web` aborts at startup with `Cannot find package`.

A [DSH](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek Harness) plugin that watches your **OpenCode GO plan** quota — the $10/month subscription that gives you usage limits on open-source models (rolling 5-hour, weekly, and monthly windows).

Compatible with DSH `0.1.7-rc.1` and `0.1.7-rc.2` — declared in `peerDependencies`, so
DSH enforces it. See [Compatibility](#compatibility) for the version matrix, what
changed in 1.4.0, and what to do on any other runtime.

## Features

- **Sidebar widget** — a live widget pinned at the bottom of the DSH web sidebar (`sidebar.footer.action` slot) showing three usage bars: rolling (5h), weekly, and monthly, each with a relative countdown to its window reset. When the sidebar is collapsed it shrinks to a compact percentage badge.
- **Time bars** — under each usage bar sits a time bar splitting the window into two: **gray on the left is time already elapsed** (growing rightward) and **blue on the right is time remaining** (shrinking leftward); at reset the gray fills up and starts over. The time bar matches the usage bar exactly in height and radius (5 px / 3 px) and differs only in color and direction; both segments are rounded on all four corners, so the outer ends *and* the junction where they meet are rounded. The gray reuses the quota bar's track token (`--dsw-alias-border-l2`), so both stacked grays are the same shade; the blue segment uses `--dsw-static-deepseek-450` (`#5686fe`). Reading quota used against time elapsed shows at a glance whether you are burning quota faster or slower than the clock. Hover for the elapsed/remaining percentages.
- **`/opencode-go` chat command** — prints the same numbers as text inside any conversation.
- **Same-origin proxy** — the host registers `GET /opencode-go/usage`, forwards to the official GO gateway with your API key. The key never reaches the browser and no CORS is involved.
- **`x-opencode-session` fix** — at runtime, injects the real harness session id into OpenCode GO gateway chat requests (the gateway 400s requests without it). No DSH file patching; survives upgrades.

## The `x-opencode-session` fix

The GO gateway rejects chat-completion requests that lack the `x-opencode-session` header (`HTTP 400 MissingSessionID`), and DSH's `llm-pi-ai` adapter never sends it. Instead of patching DSH's installed files (which every DSH upgrade overwrites), this plugin:

- wraps `globalThis.fetch` once, and
- listens to DSH's official `llm/stream` waterfall event to capture the per-call harness session id (`options.sessionId`, filled by `dsh-agent-loop`).

The gateway base is resolved from the **called provider's own live config** (`llm-pi-ai.providers.<route>.baseURL`, falling back to this plugin's `baseUrl`) — no host names are hard-coded — so only requests to that call's gateway receive the header, with the real per-conversation session id.

- Toggle: `injectSessionHeader` in the plugin config (default `true`).
- Observability: `GET /opencode-go/usage` returns `sessionHeader: { active, count, diag }`; `diag` reports what the runtime saw, e.g. `streamSeen` (handled `llm/stream` calls), `lastStream` (provider, session-id presence, base and its source), `requests`/`injected`/`missed` (wire fetches that carried the context, got the header, or fell through on a URL mismatch).

## How it works

The plugin is a **dual-half DSH package**:

| half | file | role |
|---|---|---|
| host (Node) | `lib/index.js` | registers the `/opencode-go/usage` web route (`ctx.webServer`) and the `/opencode-go` command (`ctx.commands`); resolves the key through DSH credentials; caches the upstream call (30 s) |
| browser | `lib/client.js` | a hand-authored `window.__ModuleLoader__.load({ id, factory })` bundle that waits for and registers into the `sidebar.footer.action` list slot, then polls the same-origin route every 60 s |

### How the sidebar widget loads

DSH `0.1.7-rc` composes the widget through the official client-modules scan: the
package's `dsh.client` declaration + `exports["./client"]` are picked up per
loader entry, the bundle is served from the `/plugins/...` combo routes, and
its boot-graph row lands in the `window.__DSH_BOOT__` manifest by the host
itself — no manual bundling or index injection. (The `0.1.1`/`0.1.2` line used a
self-hosted `/dsh-opencode-go-usage/client.js` route + `webServer.tapIndex` row
injection; that was removed because `0.1.7-rc` replaced the array-shaped boot
manifest with a `{ rev, entries, batches }` object that must come from
client-modules only.)

## Compatibility

| plugin | DSH runtime | host half | browser half |
|---|---|---|---|
| **1.4.0** (current) | `0.1.7-rc.1`, `0.1.7-rc.2` | `Config` schema read by the loader; config taken from the plugin entry (no `ctx.settings.register`/`settings.get`) | composed by `client-modules` from the package's `dsh.client` declaration |
| 1.3.3 | `0.1.1-rc.2`, `0.1.2-alpha.2` (the pre-`0.1.7` line) | `ctx.settings.register` namespace + `ctx.settings.get` reads | self-hosted bundle route + `webServer.tapIndex` boot-graph row |

The supported runtimes are declared in `peerDependencies`:

```json
"peerDependencies": {
  "@deepseek-ai/schemastery": "^3.18.4",
  "@deepseek-ai/dsh": "0.1.7-rc.1 || 0.1.7-rc.2"
}
```

DSH validates the `@deepseek-ai/dsh` range against the running runtime before an entry
activates, so a listed runtime loads normally while an unlisted one fails loudly with an
actionable message rather than half-working (the `0.1.7` line changed both the settings
seam and the boot manifest, which is exactly what 1.4.0 migrated onto). On any other
runtime, either install the plugin version that targets it (`1.3.3` for the pre-`0.1.7`
line) or accept the risk explicitly and restart DSH:

```bash
dsh plugin allow-version     # exact-version exemption for name@version on this dsh
```

Two runtime notes for the supported versions:

- **Settings page / hot-edit / legacy import** — the config fields are marked volatile,
  which needs schemastery ≥ `3.18.4`. Both official packages are declared as peers rather
  than dependencies, so a fresh install resolves the copy DSH itself ships; a profile that
  still hoists an older `3.18.2` gets no auto-generated settings page, no hot-edit, and no
  migration of a legacy `~/.dsh/settings.yaml` section (that section stays behind in
  `settings.yaml.imported`). Either way the plugin activates and reads its config from the
  profile entry (see [Config reference](#config-reference)).
- **Widget** — no manual bundling or index injection is involved: the host composes it
  from the package's `dsh.client` declaration and serves it over `/plugins/...`
  (see [How the sidebar widget loads](#how-the-sidebar-widget-loads)).

## Requirements

- DSH `0.1.7-rc.1` or `0.1.7-rc.2` installed and the `web` profile booted at least once (`~/.dsh/profiles/web` exists)
- Node.js ≥ 18 (for `fetch`)
- An OpenCode GO subscription and its API key

## Install (official DSH flow)

Requirements: DSH `0.1.7-rc.1` or `0.1.7-rc.2` installed with the `web` profile booted
once, Node.js ≥ 18, an OpenCode GO subscription.

```bash
# 1. install the package into your web profile (pnpm; enable via corepack if needed)
dsh plugin --profile web add @astervolans/dsh-opencode-go-usage

# 2. store your GO API key as a DSH credential
#    (create the key at https://opencode.ai/auth)
#    → add to ~/.dsh/.credentials.yaml:
#      OPENCODE_GO_API_KEY: sk-...

# 3. restart `dsh web` and hard-refresh the browser page
```

That's it for the quota widget and `/opencode-go` command. The CLI reconciles
the package's `dsh.bundle.patch` into the profile's bundle stack automatically
— no manual `cordis.patch.yml` editing, no symlinks.

Not published on npm yet? Install from a checkout instead:

```bash
dsh plugin --profile web add /path/to/dsh-opencode-go-usage
```

> New to DSH plugins? Follow the [user guide](docs/INSTALL.zh.md) (Chinese, step-by-step).

## Usage

- **Widget**: read it. Collapsed sidebar → percentage badge; expanded → three progress bars with reset countdowns.
- **Command**: `/opencode-go` in any conversation prints the three windows as text.

## Config reference

All fields are marked volatile, so they show up in Settings → Plugins → Plugin
configuration and hot-apply without a restart:

| key | default | description |
|---|---|---|
| `apiKeyEnv` | `OPENCODE_GO_API_KEY` | credential reference / env var name for the API key |
| `baseUrl` | `https://opencode.ai/zen/go` | gateway base URL |
| `cacheMs` | `30000` | host-side upstream cache TTL |
| `updateCheck` | `true` | check npm for newer versions (widget + command show a hint; the plugin never self-upgrades) |
| `injectSessionHeader` | `true` | inject the runtime `x-opencode-session` header for GO gateway chat calls |

> The volatile marking is guarded: `.volatile()` exists from schemastery 3.18.4,
> and DSH resolves a plugin's dependencies from the profile first. With an older
> hoisted copy (3.18.2) the plugin still activates and reads its config from the
> profile entry, but the auto-generated settings page and hot-edit stay off —
> reinstall the plugin (or update `@deepseek-ai/schemastery` in the profile) to
> get them. Either way the config can be set in the profile patch:

```yaml
- id: dsh-opencode-go-usage
  config:
    cacheMs: 60000
```

## The usage API

`GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>`:

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 0,  "resetsAt": "2026-08-14T07:51:13Z" },
    "weekly":  { "status": "ok", "percent": 1,  "resetsAt": "2026-08-17T00:00:00Z" },
    "monthly": { "status": "ok", "percent": 22, "resetsAt": "2026-08-21T13:05:13Z" }
  }
}
```

## Developing / modifying the widget

The browser half is a **hand-authored factory bundle** (`window.__ModuleLoader__.load`), because out-of-tree client plugins have no public build pipeline yet. It may only `require()` modules from the shell module table (`react`, `react/jsx-runtime`, and the registered client packages). Edit `lib/client.js` directly, then restart `dsh web` and refresh the page — the bundle revision hash changes and the shell loads the new file.

Host changes (`lib/index.js`) need only a `dsh web` restart.

## Troubleshooting

- **Widget missing after restart** → hard-refresh the page (`Cmd/Ctrl+Shift+R`); the boot graph is injected per page load.
- **`/opencode-go/usage` returns 502 with "no API key"** → configure the key in `~/.dsh/.credentials.yaml`.
- **Gateway 401/403** → the key is invalid or the subscription lapsed; check the credential.
- **Widget shows an error string** → hover the collapsed badge or read the error line in the expanded widget.

## License

MIT
