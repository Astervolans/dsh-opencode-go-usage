# @astervolans/dsh-opencode-go-usage

[English](README.md) | 中文

> ⚡ **OpenCode GO 套餐**: [buycodingplan.com](https://buycodingplan.com/)

> **这是 [yumusb/dsh-opencode-go-usage](https://github.com/yumusb/dsh-opencode-go-usage) 的 fork**
> ([Astervolans/dsh-opencode-go-usage](https://github.com/Astervolans/dsh-opencode-go-usage)),
> 发布为 scoped 包 `@astervolans/dsh-opencode-go-usage`。相对上游的差异:**每条用量进度条下方新增一条时间进度条**;
> 以及(1.6.0,源码树)**额度来源** —— 可读取 `dsh-opencode-go` 插件的当前账号,并带独立的应用包设置页(见「功能」)。
> 插件的设置命名空间、HTTP 路由与命令名仍是 `dsh-opencode-go-usage`(不变),所以从上游迁移过来无需改动配置;
> 仅 `dsh.bundle.patch` 的 `name` 必须是可解析的包名(scoped),否则 `dsh web` 会在启动时报 `Cannot find package`。

[DSH](https://github.com/deepseek-ai/deepseek-harness)(DeepSeek Harness)插件:监控你的 **OpenCode GO 套餐**额度 —— 10 美元/月的订阅,按模型提供滚动 5 小时 / 每周 / 每月三个窗口的用量限额。

兼容 DSH `0.1.7` 及以上(含 `0.2.0` 线) —— 已写入 `peerDependencies`(`>=0.1.7-rc.1 <0.3.0`),
由 DSH 校验。版本矩阵、1.6.0 的改动,以及其他运行时怎么办,见[兼容性](#兼容性)。

> **1.6.0 —— 仅本源码树。** 小组件现在还能读取 `dsh-opencode-go` 插件的**当前账号**,并在
> **侧边栏「插件」→ 本应用包**下新增一个设置页,用来在「跟随该插件」与「DSH 内置提供商」之间选择。
> 这是源码级改动,不是 npm 发布:1.6.0 没有发布版本也没有 git tag —— 请从本地源码目录安装
> (见[从本地目录安装](#从本地目录安装))。

## 功能

- **额度来源**:默认情况下,小组件通过 `dsh-opencode-go` 插件的 `opencodeGoUsage` host 服务读取**当前账号**的用量,因此数字与该插件自己的设置页一致(插件自动切换账号时也会跟随)。若该插件未安装、被禁用、版本不兼容,或读取失败,则自动回退到内置提供商(`baseUrl` + `/v1/usage`,credential 取 `apiKeyEnv`),并标注这一结果;`quotaSource: builtin` 可固定走内置路径。见[额度来源与回退](#额度来源与回退)。
- **应用包设置页**:注册在 `plugins.bundle.config` 槽位的配置页(侧边栏**插件**面板 → 本应用包的卡片):可选择额度来源,并查看实时检测状态(`dsh-opencode-go` 版本、当前账号、生效来源、回退原因)。它与 设置 → 插件 → 插件配置 并存,见[设置页](#设置页)。
- **侧边栏小组件**:常驻 DSH Web 侧边栏底部(`sidebar.footer.action` 槽位),三条用量进度条:滚动窗口(5h)、周窗口、月窗口,每条带重置倒计时;侧边栏收起时收缩为紧凑的百分比徽标。
- **时间进度条**:每条用量条下方还有一条时间条,把本窗口的时间轴一分为二——**左侧灰色是已流逝时间**(随时间向右增长),**右侧蓝色是剩余时间**(随时间向左收缩),窗口重置时灰色占满并归零。时间条与用量条**同高同圆角**(5px / 3px),仅颜色与方向不同;灰段与蓝段各自四角圆角,外侧两端与两段相接处都是圆角。灰段与上方用量条的轨道灰使用同一个主题 token(`--dsw-alias-border-l2`),两条灰上下同色;蓝段用 `--dsw-static-deepseek-450`(`#5686fe`)。用量条(消耗了多少额度)与时间条(过去了多少时间)上下对照,可直接看出额度消耗快于还是慢于时间流逝。悬停显示已流逝/剩余时间百分比。
- **`/opencode-go` 聊天命令**:在对话中以文本输出同样的三个窗口数字。
- **同源代理**:host 端注册 `GET /opencode-go/usage`,默认经 `dsh-opencode-go` 读取额度,或携带你的 API key 转发到官方 GO 网关。key 永不进入浏览器,也没有 CORS 问题。
- **`x-opencode-session` 修复**:运行时自动为 OpenCode GO 网关的聊天请求注入真实会话 ID(网关对缺失该头的请求返回 400)。不修改 DSH 安装文件,升级不失效。

## 额度来源与回退

一个 volatile 配置项 `quotaSource` 决定数字来自哪里:

| `quotaSource` | 行为 |
|---|---|
| `opencode-go`(默认) | 通过 `dsh-opencode-go` 插件的 `opencodeGoUsage` host 服务读取当前账号的用量;若该插件缺失、被禁用、不兼容或读取失败,则回退到内置提供商并说明原因。 |
| `builtin` | 始终走 1.x 的路径:`${baseUrl}/v1/usage`,credential 取 `apiKeyEnv`。完全不接触 `dsh-opencode-go`。 |

在 `opencode-go` 模式下,host 按以下顺序探测,任一步骤失败都会记录原因:

1. 存在实时 loader 条目 `opencode-go`(或 `dsh-opencode-go`);
2. 该条目未被禁用;
3. `ctx.get("opencodeGoUsage")` 能解析出服务且带 `read()`;
4. `await read()` 返回三个窗口(rolling / weekly / monthly);
5. 从该条目的实时配置解析当前账号(`apiKeyEnv`,再按同一 `apiKeyEnv` 匹配 `accounts[]`),并从可解析的 `dsh-opencode-go/package.json` 读版本号。

任一步骤失败时路由仍返回 **HTTP 200**,但带 `source: "builtin"`、`requested: "opencode-go"`、
`fallback` 对象与 `opencodeGo` 诊断块 —— 小组件显示内置数字并加以标注。只有**两个来源都失败**
时 `/opencode-go/usage` 才返回 502。`quotaSource: builtin` 不会触发回退(根本没探测),因此
`fallback` 为 `null`、也没有徽标。

### 回退原因

| `fallback.reason` | 含义 |
|---|---|
| `not-installed` | 没有实时 loader 条目 `opencode-go` / `dsh-opencode-go` —— 本 profile 未安装,或尚未加载(装好后重启 `dsh web`) |
| `entry-disabled` | 条目存在但在 profile 里被禁用 |
| `service-unavailable` | 条目已启用,但没有 `opencodeGoUsage` 或其缺少 `read()`(通常是 `dsh-opencode-go` 版本较旧、尚未提供该服务) |
| `read-failed` | `read()` 抛错 —— 即该插件自身的错误(例如其当前账号没有 credential),原文见 `fallback.message` |
| `invalid-response` | `read()` 返回值里没有三个有效窗口 |

### 账号显示

- 当前账号有名字时,小组件标题变为 `OpenCode GO · <账号名>`(展开面板与收起后的 rail 标题都是)。账号没有名字时保持 `OpenCode GO`。
- 只有**真的发生回退**时(请求 `opencode-go`、实际 `builtin`)才显示一个小 **内置**(英文界面为 **Built-in**)徽标,其提示(tooltip)里带原因与信息。主动固定 `builtin` 不算回退,不显示徽标;接口返回里的 `source` 始终表示实际生效的来源。

### 设置页

插件在 DSH 官方 **`plugins.bundle.config`** 槽位注册了一个配置页,以包名为 key:

**侧边栏 →「插件」面板 → `@astervolans/dsh-opencode-go-usage` 的卡片 → 配置页。**

页面上有:

- 两个来源的选择 —— **优先 dsh-opencode-go(当前账号)** 或 **DSH 内置提供商**,默认取当前 `quotaSource`;
- 由 `GET /opencode-go/settings` 驱动的状态面板:是否检测到 `dsh-opencode-go`、其版本、当前账号、服务是否可用/兼容、生效来源、回退原因与信息;
- **保存**(`POST /opencode-go/settings`,带 `{ patch: { quotaSource }, expectedRevision }`)与**重新加载**按钮,以及成功/失败/冲突提示。出现 revision 冲突说明配置在别处被改过(另一个标签页、设置表单、profile)—— 先重新加载再保存。

它与 **设置 → 插件 → 插件配置** 并存:两者改的是同一份条目配置,所以 `quotaSource` 在那边也会作为普通字段出现,任一处保存都即时生效。该路由只接受 `quotaSource`,保存成功后 host 会让额度缓存失效,下一次小组件轮询即反映新来源 —— 无需重启 `dsh web`。若 DSH 无法描述本插件的设置(条目 id / schemastery),该路由返回 503、页面会提示;此时改用 profile patch 设置 `quotaSource`。

## `x-opencode-session` 修复

OpenCode GO 网关拒绝缺少 `x-opencode-session` 头的聊天补全请求(`HTTP 400 MissingSessionID`),而 DSH 的 `llm-pi-ai` 适配器从不发送该头。与其修改 DSH 安装目录里的文件(每次 DSH 升级都会被覆盖),本插件改为运行时注入:

- 一次性包装 `globalThis.fetch`;
- 监听 DSH 官方 `llm/stream` waterfall 事件,获取每次调用的会话 ID(`options.sessionId`,由 `dsh-agent-loop` 填充)。

网关 base 从**被调用 provider 自身的实时配置**解析(`llm-pi-ai.providers.<route>.baseURL`,缺省回退到本插件的 `baseUrl`)——代码中不硬编码任何域名——因此只有发往该调用对应网关的请求才会收到该头,且值为真实的会话级 ID。

- 开关:插件配置项 `injectSessionHeader`(默认 `true`)。
- 可观测性:`GET /opencode-go/usage` 返回 `sessionHeader: { active, count, diag }`;`diag` 报告运行时观测,如 `streamSeen`(处理过的 `llm/stream` 调用数)、`lastStream`(provider、session-id 是否存在、base 及其来源)、`requests`/`injected`/`missed`(带上下文的 wire 请求数 / 实际注入数 / 因 URL 不匹配未注入数)。

## 工作原理

这是一个**双端 DSH 插件包**:

| 端 | 文件 | 职责 |
|---|---|---|
| host(Node) | `lib/index.js` | 注册 `/opencode-go/usage` Web 路由与 `/opencode-go/settings` 一对路由(`ctx.webServer`),以及 `/opencode-go` 命令(`ctx.commands`);解析额度来源(优先 `dsh-opencode-go` 的 `opencodeGoUsage` 服务,失败回退内置)并通过 DSH credentials 解析 key;上游调用带 30s 缓存(按来源 + 账号区分) |
| 浏览器 | `lib/client.js` | 手写的 `window.__ModuleLoader__.load({ id, factory })` bundle，等待 `sidebar.footer.action` 列表槽与 `plugins.bundle.config` 槽就绪后注册，每 60s 轮询同源路由 |

### 侧边栏小组件如何加载

DSH `0.1.7-rc` 通过官方 client-modules 扫描来装载组件:包的 `dsh.client` 声明 +
`exports["./client"]` 会按 loader entry 被自动识别,bundle 由 `/plugins/...`
组合路由提供,boot graph 行由 host 自己写进 `window.__DSH_BOOT__` 清单——
无需手工打包或注入 index。(`0.1.1`/`0.1.2` 用的是自托管 `/dsh-opencode-go-usage/client.js`
路由 + `webServer.tapIndex` 行注入;该机制已移除,因为 `0.1.7-rc` 把数组形的 boot
清单改成了 `{ rev, entries, batches }` 对象,只能由 client-modules 生成。)

## 兼容性

| 插件版本 | DSH 运行时 | host 端 | 浏览器端 |
|---|---|---|---|
| **1.6.0**(本源码树) | `0.1.7` 及以上,含 `0.2.0` 线 | 同 1.5.0,另加经 `opencodeGoUsage` 的额度来源探测,以及 `GET`/`POST /opencode-go/settings` 路由 | 同 1.5.0,另加 `plugins.bundle.config` 槽位注册(应用包设置页)与账号/回退显示 |
| 1.5.0 | `0.1.7` 及以上,含 `0.2.0` 线 | 由 loader 读取导出的 `Config` schema;配置取自插件条目(不再调用 `ctx.settings.register`/`settings.get`) | 由 `client-modules` 依据包的 `dsh.client` 声明自动装配 |
| 1.4.0 | `0.1.7-rc.1`、`0.1.7-rc.2` | 同 1.5.0 | 同 1.5.0 |
| 1.3.3 | `0.1.1-rc.2`、`0.1.2-alpha.2`(即 `0.1.7` 之前的版本线) | `ctx.settings.register` 注册命名空间 + `ctx.settings.get` 读取 | 自托管 bundle 路由 + `webServer.tapIndex` 注入启动图行 |

支持的运行时写进了 `peerDependencies`:

```json
"peerDependencies": {
  "@deepseek-ai/schemastery": "^3.18.4",
  "@deepseek-ai/dsh": ">=0.1.7-rc.1 <0.3.0"
}
```

`dsh-opencode-go` 本身是**可选**的,也没有声明为依赖:在 `opencode-go` 模式下 host 运行时探测它,
没有安装属于正常回退(`not-installed`),不是错误。想让小组件跟随其当前账号,就在同一个
profile 里装上它。

DSH 会在条目启用前用该范围校验当前运行时。从 `0.2.0` 起这是**硬闸门**:所有
`@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer 都会带 `includePrerelease` 参与判定,
不匹配则**整行被禁用**(宿主日志会写 `disabling profile plugin row …`),而不是半死不活
地跑着。因此窗口写成 `>=0.1.7-rc.1 <0.3.0`,同时覆盖 `0.1.7` 线与整条 `0.2.0` 线;
1.4.0 的写法 `0.1.7-rc.1 || 0.1.7-rc.2` 做不到 —— 任何 `0.1.x` 范围的上界都是 `<0.2.0`。
若运行时不在此列,请改装对应版本的插件(`0.1.7` 之前用 `1.3.3`),或显式接受风险后重启 DSH:

```bash
dsh plugin allow-version     # 为 name@version 在本 dsh 版本上授予精确版本豁免
```

在受支持版本上还有三点运行时说明:

- **设置页 / 热改 / 旧配置迁移** —— 配置字段标记为 volatile,需要 schemastery ≥ `3.18.4`。两个官方包都按
  约定声明为 peer 而非 dependency,因此全新安装会解析到 DSH 自带的那份;若 profile 里仍 hoist 着旧的
  `3.18.2`,则不会生成设置页、不能热改,旧的 `~/.dsh/settings.yaml` 段落也不会被迁移(会留在
  `settings.yaml.imported`)。两种情况插件都照常启用,并从 profile 条目读取配置(见[配置项](#配置项))。
- **小组件** —— 全程无需手工打包或注入 index:host 依据包的 `dsh.client` 声明装配组件,并从
  `/plugins/...` 组合路由提供(见[侧边栏小组件如何加载](#侧边栏小组件如何加载))。
- **应用包设置页** —— 1.6.0 的设置页通过 DSH 的 `plugins.bundle.config` 槽位渲染,已在 `0.2.1-rc.4`
  host(Desktop Next `2.0.21-next`)上验证。若你的运行时不提供该槽位,请改用
  设置 → 插件 → 插件配置 或 profile patch 配置 `quotaSource`;侧边栏小组件与 `/opencode-go`
  命令不受影响。

## 环境要求

- 已安装 DSH `0.1.7` 及以上(含 `0.2.0` 线),且 `web` profile 至少启动过一次(`~/.dsh/profiles/web` 存在)
- Node.js ≥ 18(需要 `fetch`)
- OpenCode GO 订阅及其 API key
- 可选:同一个 profile 里的 `dsh-opencode-go` 插件 —— 装了它,默认的 `opencode-go` 来源就会跟随该插件的当前账号;没装则小组件回退到内置提供商

## 安装(官方 DSH 流程)

前置:已装 DSH `0.1.7` 及以上(含 `0.2.0` 线),且 `web` profile 至少启动过一次;Node.js ≥ 18;有 OpenCode GO 订阅。

> **1.6.0 仅存在于本源码树。** 本文档里的注册表命令安装的是最新发布版(1.5.0),
> 不含额度来源功能;想试用请从本地源码目录安装(见[从本地目录安装](#从本地目录安装))。

```bash
# 1. 安装到 web profile(依赖 pnpm,没有的话先 corepack enable)
dsh plugin --profile web add @astervolans/dsh-opencode-go-usage

# 2. 把 GO API key 存为 DSH credential
#    (key 在 https://opencode.ai/auth 创建)
#    → 在 ~/.dsh/.credentials.yaml 加一行:
#      OPENCODE_GO_API_KEY: sk-...

# 3. 重启 dsh web,浏览器硬刷新(Cmd/Ctrl+Shift+R)
```

到这一步,百分比小组件和 `/opencode-go` 命令就生效了。CLI 会自动把包的
`dsh.bundle.patch` 合并进 profile 的 bundle 层栈——**不需要手改
cordis.patch.yml,不需要软链**。

重启后打开 **侧边栏 →「插件」→ `@astervolans/dsh-opencode-go-usage` 的卡片 → 配置页**,
即可确认或修改额度来源(默认 `opencode-go`)。默认值无需任何配置即可工作;页面还会显示
是否检测到 `dsh-opencode-go`、正在读取哪个账号(见[设置页](#设置页))。

### 从 GitHub Packages 安装

每次发布也会自动同步到 GitHub Packages(`https://npm.pkg.github.com`),由 release
工作流完成。该注册表**即使对公开包也要求认证**,请先准备一个至少有 `read:packages`
权限的 PAT,写进 `.npmrc`(项目级或 `~/.npmrc`):

```
@astervolans:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=你的_GITHUB_PAT
```

```bash
dsh plugin --profile web add @astervolans/dsh-opencode-go-usage
```

选择这条路之前先了解两点:

- 包在 GitHub 上**默认是 private**(仓库公开也一样),首次发布后需要手动改成 public:
  [包设置](https://github.com/users/Astervolans/packages/npm/dsh-opencode-go-usage/settings)
  → Danger Zone → Change visibility。
- 安装需要 token,所以 npmjs.org(不需要 token、不需要 scope 行)仍是更省事的路。
  GitHub Packages 是镜像,不是替代。

### 从本地目录安装

```bash
dsh plugin --profile web add /path/to/dsh-opencode-go-usage
```

> 第一次装 DSH 插件?直接看[使用者指南](docs/INSTALL.zh.md),一步步照着做就行。

## 使用

- **小组件**:直接看。侧边栏收起 → 百分比徽标;展开 → 三条进度条 + 重置倒计时。标题会显示 `dsh-opencode-go` 的当前账号(`OpenCode GO · <账号名>`),发生回退时带 **内置** 徽标。
- **命令**:任意对话里输入 `/opencode-go` 输出三个窗口的文本。
- **额度来源**:默认 `opencode-go` 跟随 `dsh-opencode-go` 插件;要切到 `builtin`,可在 侧边栏 →「插件」→ 本应用包卡片、设置 → 插件 → 插件配置,或 profile patch 里改。

## 配置项

所有字段都是 volatile,因此会出现在 设置 → 插件 → 插件配置 中(`quotaSource` 还会出现在应用包设置页),改完即时生效、无需重启:

| 键 | 默认 | 说明 |
|---|---|---|
| `quotaSource` | `opencode-go` | 额度数字的来源:`opencode-go`(优先用 `dsh-opencode-go` 插件的当前账号,失败自动回退内置提供商)或 `builtin`(始终走 `${baseUrl}/v1/usage`)。未知值会归一化为 `opencode-go` |
| `apiKeyEnv` | `OPENCODE_GO_API_KEY` | API key 的 credential 引用 / 环境变量名(内置路径;`opencode-go` 模式下回退时也用它) |
| `baseUrl` | `https://opencode.ai/zen/go` | 网关 base URL(内置路径) |
| `cacheMs` | `30000` | host 端上游缓存 TTL |
| `updateCheck` | `true` | 检查 npm 新版本(组件与命令只提示,插件不会自行升级) |
| `injectSessionHeader` | `true` | 为 GO 网关聊天调用注入运行时 `x-opencode-session` 头 |

> `quotaSource` 只是**偏好**,不是保证:`opencode-go` 模式下探测失败仍会显示内置数字,
> 并用徽标标注、在 `/opencode-go/usage` 的 `fallback` 里说明。想彻底不探测就设为 `builtin`。

> volatile 标记是**带守卫**的:`.volatile()` 从 schemastery 3.18.4 起才有,而 DSH
> 解析插件依赖时**优先用 profile 里的副本**。若 profile 里仍是旧副本(3.18.2),
> 插件照常启用、并从 profile 条目读取配置,只是不会生成设置页、也不能热改——
> 重装插件(或在 profile 里升级 `@deepseek-ai/schemastery`)即可获得。两种情况下
> 都可以直接在 profile patch 里配置:

```yaml
- id: dsh-opencode-go-usage
  config:
    cacheMs: 60000
    quotaSource: builtin   # 可选:强制走内置提供商
```

## 用量 API

`GET https://opencode.ai/zen/go/v1/usage`,带 `Authorization: Bearer <key>`:

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 0,  "resetsAt": "2026-08-14T07:51:13Z" },
    "weekly":  { "status": "ok", "percent": 1,  "resetsAt": "2026-08-17T00:00:00Z" },
    "monthly": { "status": "ok", "percent": 22, "resetsAt": "2026-08-21T13:05:13Z" }
  }
}
```

### 同源路由

小组件与命令从不直接访问网关,由 host 代理并附加信息:

**`GET /opencode-go/usage`** —— 1.5.0 的字段(`usage`、`update`、`sessionHeader`)之外,1.6.0 新增:

| 字段 | 含义 |
|---|---|
| `source` | `usage` 里数字的实际来源:`opencode-go` 或 `builtin` |
| `requested` | 配置的 `quotaSource` |
| `account` | `dsh-opencode-go` 的当前账号:`{ ref, id, name }`(`builtin` 模式下为配置的 ref) |
| `fallback` | `null`,或插件路径失败而改用内置时的 `{ from: "opencode-go", reason, message }` |
| `opencodeGo` | 检测信息:`{ detected, version, entryFound, enabled, service, compatible, reason, message }` |
| `lastSwitch` | `dsh-opencode-go` 最近一次账号切换(`fromRef`、`toRef`、`reason`、`at`),没有则为 `null` |

两个来源都失败时仍返回 **HTTP 502** —— `{ error, requested, opencodeGo, fallback }`。

**`GET /opencode-go/settings`** —— `{ ok, namespace, revision, value, base, user, detection }`:
`value` 是脱敏后的配置,`detection` 另含 `dsh-opencode-go` 的账号列表与生效来源。DSH 无法
描述本插件设置时返回 503。

**`POST /opencode-go/settings`** —— `{ patch: { quotaSource }, expectedRevision }` →
`{ ok, revision, detection }`。只接受 `quotaSource`;`expectedRevision` 过期返回 `409`,
请求体/取值非法返回 `400`,跨源 `Origin` 返回 `403`。

## 开发 / 修改小组件

浏览器端是**手写的 factory bundle**(`window.__ModuleLoader__.load`),因为目前第三方 client 插件还没有公开的构建流水线。它只能 `require()` shell 模块表里的模块(`react`、`react/jsx-runtime` 以及已注册的 client 包)。直接改 `lib/client.js`,然后重启 `dsh web` 并刷新页面 —— bundle 的 revision hash 会变化,shell 会加载新文件。

host 端(`lib/index.js`)的改动只需重启 `dsh web`。

1.6.0 的应用包设置页是同一个 bundle 里的第二处注册(`plugins.bundle.config`,以包名为 key)。
组件按 `props.view` 分支:`summary` 必须返回纯字符串(插件面板的卡片会直接内联渲染),
`page` 才挂载设置组件。两端都走同一组 `/opencode-go/...` 路由 —— 设置页不直接读配置,
而是经 `GET`/`POST /opencode-go/settings`。

## 常见问题

- **重启后小组件不出现** → 硬刷新页面(`Cmd/Ctrl+Shift+R`);启动图是按页面加载注入的。
- **`/opencode-go/usage` 返回 502 且提示 "no API key"** → 在 `~/.dsh/.credentials.yaml` 配置 key。
- **网关 401/403** → key 无效或订阅过期;检查 credential。
- **小组件显示错误串** → 悬停收起态徽标,或展开态小组件里的错误行。
- **装了 `dsh-opencode-go` 但仍回退到内置** → 执行 `curl -s http://127.0.0.1:3080/opencode-go/usage`,看 `source`、`fallback` 与 `opencodeGo` 块(徽标提示里是同样的原因)。再按 `fallback.reason` 处理:`not-installed` → 本 profile 没有 `opencode-go`/`dsh-opencode-go` 的实时 loader 条目(装到同一个 profile,或重启 `dsh web` 让条目加载);`entry-disabled` → 在 设置 → 插件 里启用该条目;`service-unavailable` → 该插件已启用但没有 `opencodeGoUsage.read()`(通常是 `dsh-opencode-go` 较旧 —— 升级它);`read-failed` / `invalid-response` → 是该插件自身报错或返回结构不对,原文在 `fallback.message`(先检查它自己的设置页与 key)。不想让它探测就设 `quotaSource: builtin`。
- **小组件标题没有账号名** → 正常现象:`dsh-opencode-go` 缺失(回退)或其当前账号没有 `name`;可看接口里的 `account.name` 确认。
- **启动失败,日志里有 `Identifier 'PACKAGE_NAME' has already been declared`** → 客户端 bundle 在 shell 的共享脚本作用域里声明了顶层同名常量(与 `@astervolans/dsh-literature-search` 等插件冲突),整个 web boot 会被判定失败。1.6.x 当前源码已把该名称移入 factory 内部;重新安装本源码并完全重启 DSH 即可。若同时使用 `dsh-literature-search`,也请确保它来自当前版本。

## License

MIT
