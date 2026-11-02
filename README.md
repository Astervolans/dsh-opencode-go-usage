# @astervolans/dsh-opencode-go-usage

English | [中文](README.zh.md)

> ⚡ Get an **OpenCode GO plan**: [buycodingplan.com](https://buycodingplan.com/)

> **This is a fork of [yumusb/dsh-opencode-go-usage](https://github.com/yumusb/dsh-opencode-go-usage)**
> ([Astervolans/dsh-opencode-go-usage](https://github.com/Astervolans/dsh-opencode-go-usage)),
> published as the scoped package `@astervolans/dsh-opencode-go-usage`. The differences from
> upstream: **a time bar under each usage bar**, and (1.6.0, source tree) a **quota source**
> that can read the `dsh-opencode-go` plugin's active account, with its own bundle settings
> page (see Features). The settings namespace, HTTP
> routes and command name are still `dsh-opencode-go-usage` (unchanged), so migrating from
> upstream needs no configuration changes; only the `dsh.bundle.patch` entry's `name` must be the
> resolvable scoped package name, or `dsh web` aborts at startup with `Cannot find package`.

A [DSH](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek Harness) plugin that watches your **OpenCode GO plan** quota — the $10/month subscription that gives you usage limits on open-source models (rolling 5-hour, weekly, and monthly windows).

Compatible with DSH `0.1.7` and above, including the `0.2.0` line — declared in
`peerDependencies` as `>=0.1.7-rc.1 <0.3.0`, so DSH enforces it. See
[Compatibility](#compatibility) for the version matrix, what changed in 1.6.0, and what
to do on any other runtime.

> **1.6.0 — this source tree.** The widget can also read the **currently active account**
> of the `dsh-opencode-go` plugin, and a new settings page under **Plugins → this bundle**
> chooses between that source and the built-in provider. This is a source-level change, not
> an npm release: there is no 1.6.0 publication or git tag to pull — install from a checkout
> (see [From a checkout](#from-a-checkout)).

## Features

- **Quota source** — by default the widget reads the **currently active account** of the `dsh-opencode-go` plugin through that plugin's `opencodeGoUsage` host service, so the numbers track the same account its own settings page shows (including automatic account switches). If that plugin is not installed, disabled, incompatible, or its usage read fails, the widget falls back to the built-in provider (`baseUrl` + `/v1/usage` with the `apiKeyEnv` credential) and marks the result. `quotaSource: builtin` pins the built-in path. See [Quota source and fallback](#quota-source-and-fallback).
- **Bundle settings page** — a configuration page in the `plugins.bundle.config` slot (sidebar **Plugins** panel → this bundle's card): pick the quota source and see the live detection status (dsh-opencode-go version, active account, effective source, fallback reason). It coexists with Settings → Plugins → Plugin configuration; see [Settings page](#settings-page).
- **Sidebar widget** — a live widget pinned at the bottom of the DSH web sidebar (`sidebar.footer.action` slot) showing three usage bars: rolling (5h), weekly, and monthly, each with a relative countdown to its window reset. When the sidebar is collapsed it shrinks to a compact percentage badge.
- **Time bars** — under each usage bar sits a time bar splitting the window into two: **gray on the left is time already elapsed** (growing rightward) and **blue on the right is time remaining** (shrinking leftward); at reset the gray fills up and starts over. The time bar matches the usage bar exactly in height and radius (5 px / 3 px) and differs only in color and direction; both segments are rounded on all four corners, so the outer ends *and* the junction where they meet are rounded. The gray reuses the quota bar's track token (`--dsw-alias-border-l2`), so both stacked grays are the same shade; the blue segment uses `--dsw-static-deepseek-450` (`#5686fe`). Reading quota used against time elapsed shows at a glance whether you are burning quota faster or slower than the clock. Hover for the elapsed/remaining percentages.
- **`/opencode-go` chat command** — prints the same numbers as text inside any conversation.
- **Same-origin proxy** — the host registers `GET /opencode-go/usage`, which reads the quota through `dsh-opencode-go` (default) or forwards to the official GO gateway with your API key. The key never reaches the browser and no CORS is involved.
- **`x-opencode-session` fix** — at runtime, injects the real harness session id into OpenCode GO gateway chat requests (the gateway 400s requests without it). No DSH file patching; survives upgrades.

## Quota source and fallback

One volatile config field, `quotaSource`, decides where the numbers come from:

| `quotaSource` | behaviour |
|---|---|
| `opencode-go` (default) | Read the active account's usage from the `dsh-opencode-go` plugin's `opencodeGoUsage` host service. If that plugin is missing, disabled, incompatible, or the read fails, fall back to the built-in provider and report why. |
| `builtin` | Always the 1.x path: `${baseUrl}/v1/usage` with the key behind `apiKeyEnv`. The `dsh-opencode-go` integration is never touched. |

In `opencode-go` mode the host probes, in order, and records a reason when a step fails:

1. a live loader entry named `opencode-go` (or `dsh-opencode-go`) exists;
2. that entry is not disabled;
3. `ctx.get("opencodeGoUsage")` resolves and exposes `read()`;
4. `await read()` returns the three windows (rolling / weekly / monthly);
5. the active account is resolved from that entry's live config (`apiKeyEnv`, then `accounts[]` matched by the same `apiKeyEnv`), and the plugin version from the resolvable `dsh-opencode-go/package.json`.

When any step fails the route still answers **HTTP 200**, but with `source: "builtin"`, `requested: "opencode-go"`, a `fallback` object and an `opencodeGo` diagnostics block — the widget shows built-in numbers marked as such. Only when **both** sources fail does `/opencode-go/usage` return 502. `quotaSource: builtin` never falls back (nothing was attempted), so there is no badge and `fallback` is `null`.

### Fallback reasons

| `fallback.reason` | meaning |
|---|---|
| `not-installed` | no live loader entry `opencode-go` / `dsh-opencode-go` — not installed in this profile, or not loaded (restart `dsh web` after installing it) |
| `entry-disabled` | the entry exists but is disabled in the profile |
| `service-unavailable` | the entry is active but `opencodeGoUsage` is missing or has no `read()` (typically a `dsh-opencode-go` version that predates the service) |
| `read-failed` | `read()` threw — that plugin's own error (for example no credential for its active account), carried in `fallback.message` |
| `invalid-response` | `read()` returned something without the three valid windows |

### Account display

- When the active account has a name, the widget title becomes `OpenCode GO · <account name>`, both in the expanded panel and in the collapsed rail title. An account without a name keeps the plain `OpenCode GO` label.
- A small **Built-in** badge (内置 in the Chinese UI) appears only when a fallback actually happened — requested `opencode-go`, served `builtin`. Its tooltip carries the reason and message. Pinned `builtin` is not a fallback and shows no badge; `source` in the API response always tells you the effective source.

### Settings page

The plugin registers a configuration page in DSH's official **`plugins.bundle.config`** slot, keyed by the package name:

**Sidebar → Plugins panel → the card for `@astervolans/dsh-opencode-go-usage` → its configuration page.**

That page offers:

- a choice between the two sources — **Prefer dsh-opencode-go (current account)** or **DSH built-in provider** — defaulted from the current `quotaSource`;
- a status panel fed by `GET /opencode-go/settings`: whether `dsh-opencode-go` was detected, its version, the active account, service availability/compatibility, the effective source, and the fallback reason/message;
- **Save** (`POST /opencode-go/settings` with `{ patch: { quotaSource }, expectedRevision }`) and **Reload** buttons, with success/error/conflict messages. A revision conflict means the config changed elsewhere (another tab, the settings form, the profile) — Reload, then Save again.

It **coexists with Settings → Plugins → Plugin configuration**: both edit the same entry config, so `quotaSource` is visible as a raw field there too, and saving in either place hot-applies. The host accepts only `quotaSource` through this route and invalidates the quota cache on success, so the next widget poll already shows the new source — no `dsh web` restart. If DSH cannot describe this plugin's settings (entry id / schemastery) the route answers 503 and the page says so; set `quotaSource` in the profile patch instead.

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
| host (Node) | `lib/index.js` | registers the `/opencode-go/usage` web route and the `/opencode-go/settings` pair (`ctx.webServer`), plus the `/opencode-go` command (`ctx.commands`); resolves the quota source (the `dsh-opencode-go` `opencodeGoUsage` service first, built-in fallback) and the key through DSH credentials; caches the upstream call (30 s, keyed by source + account) |
| browser | `lib/client.js` | a hand-authored `window.__ModuleLoader__.load({ id, factory })` bundle that waits for and registers into the `sidebar.footer.action` list slot and the `plugins.bundle.config` slot, then polls the same-origin route every 60 s |

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
| **1.6.0** (this source tree) | `0.1.7` and above, including the `0.2.0` line | same as 1.5.0, plus the quota-source probe through `opencodeGoUsage` and the `GET`/`POST /opencode-go/settings` routes | same as 1.5.0, plus a second registration into `plugins.bundle.config` (the bundle settings page) and the account/fallback display |
| 1.5.0 | `0.1.7` and above, including the `0.2.0` line | `Config` schema read by the loader; config taken from the plugin entry (no `ctx.settings.register`/`settings.get`) | composed by `client-modules` from the package's `dsh.client` declaration |
| 1.4.0 | `0.1.7-rc.1`, `0.1.7-rc.2` | same as 1.5.0 | same as 1.5.0 |
| 1.3.3 | `0.1.1-rc.2`, `0.1.2-alpha.2` (the pre-`0.1.7` line) | `ctx.settings.register` namespace + `ctx.settings.get` reads | self-hosted bundle route + `webServer.tapIndex` boot-graph row |

The supported runtimes are declared in `peerDependencies`:

```json
"peerDependencies": {
  "@deepseek-ai/schemastery": "^3.18.4",
  "@deepseek-ai/dsh": ">=0.1.7-rc.1 <0.3.0"
}
```

`dsh-opencode-go` itself is **optional** and declared nowhere: in `opencode-go` mode the
host probes for it at runtime, and its absence is a normal fallback (`not-installed`), not
an error. Install it in the same profile if you want the widget to follow its active
account.

DSH validates the `@deepseek-ai/dsh` range against the running runtime before an entry
activates. From `0.2.0` on that validation is a hard gate: every `@deepseek-ai/dsh` /
`@deepseek-ai/dsh-*` peer is tested with `includePrerelease`, and a mismatch disables the
whole profile row (the host logs `disabling profile plugin row …`) rather than
half-working. The `>=0.1.7-rc.1 <0.3.0` window therefore spans the `0.1.7` line and the
whole `0.2.0` line; the 1.4.0 value `0.1.7-rc.1 || 0.1.7-rc.2` cannot, because any
`0.1.x` range stops at `<0.2.0`. On an unlisted runtime, either install the plugin version
that targets it (`1.3.3` for the pre-`0.1.7` line) or accept the risk explicitly and
restart DSH:

```bash
dsh plugin allow-version     # exact-version exemption for name@version on this dsh
```

Three runtime notes for the supported versions:

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
- **Bundle settings page** — the 1.6.0 page is rendered through DSH's
  `plugins.bundle.config` slot, verified on the `0.2.1-rc.4` host (Desktop Next
  `2.0.21-next`). If your runtime does not expose that slot, configure `quotaSource`
  from Settings → Plugins → Plugin configuration or the profile patch instead; the
  sidebar widget and the `/opencode-go` command are unchanged.

## Requirements

- DSH `0.1.7` or newer, including the `0.2.0` line, installed and the `web` profile booted at least once (`~/.dsh/profiles/web` exists)
- Node.js ≥ 18 (for `fetch`)
- An OpenCode GO subscription and its API key
- Optional: the `dsh-opencode-go` plugin in the same profile — with it installed the default `opencode-go` source follows that plugin's active account; without it the widget falls back to the built-in provider

## Install (official DSH flow)

Requirements: DSH `0.1.7` or newer, including the `0.2.0` line, installed with the `web`
profile booted once, Node.js ≥ 18, an OpenCode GO subscription.

> **1.6.0 is in this source tree only.** The registry commands on this page install the
> latest published release (1.5.0) and do not contain the quota-source feature; install the
> checkout ([From a checkout](#from-a-checkout)) to try it.

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

After the restart, open **sidebar → Plugins → the `@astervolans/dsh-opencode-go-usage`
card → its configuration page** to confirm or change the quota source (default
`opencode-go`). Nothing has to be configured for the default to work; the page also shows
whether `dsh-opencode-go` was detected and which account is being read
(see [Settings page](#settings-page)).

### From GitHub Packages

Every release also publishes to GitHub Packages
(`https://npm.pkg.github.com`), automatically, from the release workflow. That
registry requires authentication **even for public packages**, so add an `.npmrc`
— project-level, or `~/.npmrc` — with a personal access token that has at least
`read:packages`:

```
@astervolans:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
```

```bash
dsh plugin --profile web add @astervolans/dsh-opencode-go-usage
```

Two things to know before choosing this route:

- The package is **private by default** on GitHub, even though the repository is
  public. The first release has to be flipped to public once, at
  [package settings](https://github.com/users/Astervolans/packages/npm/dsh-opencode-go-usage/settings)
  → Danger Zone → Change visibility.
- Because installation needs a token, npmjs.org (no token, no scope line) stays
  the friendlier path. GitHub Packages is a mirror, not a replacement.

### From a checkout

```bash
dsh plugin --profile web add /path/to/dsh-opencode-go-usage
```

> New to DSH plugins? Follow the [user guide](docs/INSTALL.zh.md) (Chinese, step-by-step).

## Usage

- **Widget**: read it. Collapsed sidebar → percentage badge; expanded → three progress bars with reset countdowns. The title shows the active `dsh-opencode-go` account (`OpenCode GO · <account name>`) and a **Built-in** badge when a fallback happened.
- **Command**: `/opencode-go` in any conversation prints the three windows as text.
- **Quota source**: default `opencode-go` follows the `dsh-opencode-go` plugin; switch to `builtin` in sidebar → Plugins → this bundle's card, in Settings → Plugins → Plugin configuration, or in the profile patch.

## Config reference

All fields are marked volatile, so they show up in Settings → Plugins → Plugin
configuration (and, for `quotaSource`, on the bundle settings page) and hot-apply without a
restart:

| key | default | description |
|---|---|---|
| `quotaSource` | `opencode-go` | where quota numbers come from: `opencode-go` (prefer the `dsh-opencode-go` plugin's active account, automatic fallback to the built-in provider) or `builtin` (always `${baseUrl}/v1/usage`). Unknown values normalize to `opencode-go` |
| `apiKeyEnv` | `OPENCODE_GO_API_KEY` | credential reference / env var name for the API key (built-in path, and the fallback path in `opencode-go` mode) |
| `baseUrl` | `https://opencode.ai/zen/go` | gateway base URL (built-in path) |
| `cacheMs` | `30000` | host-side upstream cache TTL |
| `updateCheck` | `true` | check npm for newer versions (widget + command show a hint; the plugin never self-upgrades) |
| `injectSessionHeader` | `true` | inject the runtime `x-opencode-session` header for GO gateway chat calls |

> `quotaSource` is a **preference**, not a guarantee: in `opencode-go` mode a probe failure
> still shows built-in numbers, marked with a badge and described by `fallback` in
> `/opencode-go/usage`. Set `builtin` to silence the probe entirely.

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
    quotaSource: builtin   # optional: force the built-in provider
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

### Same-origin routes

The widget and command never call the gateway directly; the host proxies and annotates:

**`GET /opencode-go/usage`** — the 1.5.0 fields (`usage`, `update`, `sessionHeader`) plus
the 1.6.0 source fields:

| field | meaning |
|---|---|
| `source` | effective source whose numbers are in `usage`: `opencode-go` or `builtin` |
| `requested` | the configured `quotaSource` |
| `account` | active `dsh-opencode-go` account: `{ ref, id, name }` (in `builtin` mode, the configured ref) |
| `fallback` | `null`, or `{ from: "opencode-go", reason, message }` when the plugin path failed and built-in was served |
| `opencodeGo` | detection block: `{ detected, version, entryFound, enabled, service, compatible, reason, message }` |
| `lastSwitch` | the `dsh-opencode-go` account switch that last occurred (`fromRef`, `toRef`, `reason`, `at`), or `null` |

A failure of both sources is still **HTTP 502** — `{ error, requested, opencodeGo, fallback }`.

**`GET /opencode-go/settings`** — `{ ok, namespace, revision, value, base, user, detection }`,
where `value` is the redacted config and `detection` adds the `dsh-opencode-go` account list
and the effective source. 503 when DSH has no settings descriptor for this plugin.

**`POST /opencode-go/settings`** — `{ patch: { quotaSource }, expectedRevision }` →
`{ ok, revision, detection }`. Only `quotaSource` is accepted; `409` on a stale
`expectedRevision`, `400` on an invalid body/value, `403` on a cross-origin `Origin`.

## Developing / modifying the widget

The browser half is a **hand-authored factory bundle** (`window.__ModuleLoader__.load`), because out-of-tree client plugins have no public build pipeline yet. It may only `require()` modules from the shell module table (`react`, `react/jsx-runtime`, and the registered client packages). Edit `lib/client.js` directly, then restart `dsh web` and refresh the page — the bundle revision hash changes and the shell loads the new file.

Host changes (`lib/index.js`) need only a `dsh web` restart.

The 1.6.0 bundle settings page is a second registration in the same bundle
(`plugins.bundle.config`, keyed by the package name). It branches on `props.view`: `summary`
must return a plain string (the Plugins card renders it inline), `page` mounts the settings
component. Keep both halves on the same `/opencode-go/...` routes — the page does not read
config directly, it goes through `GET`/`POST /opencode-go/settings`.

## Troubleshooting

- **Widget missing after restart** → hard-refresh the page (`Cmd/Ctrl+Shift+R`); the boot graph is injected per page load.
- **`/opencode-go/usage` returns 502 with "no API key"** → configure the key in `~/.dsh/.credentials.yaml`.
- **Gateway 401/403** → the key is invalid or the subscription lapsed; check the credential.
- **Widget shows an error string** → hover the collapsed badge or read the error line in the expanded widget.
- **`dsh-opencode-go` is installed but quota falls back to built-in** → run `curl -s http://127.0.0.1:3080/opencode-go/usage` and read `source`, `fallback`, and the `opencodeGo` block (the badge tooltip carries the same reason). Then act on `fallback.reason`: `not-installed` → no live loader entry for `opencode-go`/`dsh-opencode-go` in this profile (install it there, or restart `dsh web` so the entry loads); `entry-disabled` → enable the entry in Settings → Plugins; `service-unavailable` → that plugin is active but exposes no `opencodeGoUsage.read()` (usually an older `dsh-opencode-go` — update it); `read-failed` / `invalid-response` → that plugin's own error or payload shape, quoted in `fallback.message` (check its own settings page and key first). If you do not want the probe at all, set `quotaSource: builtin`.
- **Widget title has no account name** → that is expected when `dsh-opencode-go` is absent (fallback) or its active account has no `name`; check `account.name` in the usage response.
- **Startup fails with `Identifier 'PACKAGE_NAME' has already been declared`** → the client bundle declared a top-level name in the shell's shared classic-script scope, colliding with another plugin (for example `@astervolans/dsh-literature-search`) and failing the whole web boot. The current 1.6.x source keeps that name factory-local; reinstall this checkout and fully restart DSH. If `dsh-literature-search` is installed too, make sure it is the current version.

## License

MIT
