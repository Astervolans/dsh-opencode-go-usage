# @astervolans/dsh-opencode-go-usage

[English](README.md) | 中文

> ⚡ **OpenCode GO 套餐**: [buycodingplan.com](https://buycodingplan.com/)

> **这是 [yumusb/dsh-opencode-go-usage](https://github.com/yumusb/dsh-opencode-go-usage) 的 fork**
> ([Astervolans/dsh-opencode-go-usage](https://github.com/Astervolans/dsh-opencode-go-usage)),
> 发布为 scoped 包 `@astervolans/dsh-opencode-go-usage`。相对上游的差异:**每条用量进度条下方新增一条时间进度条**(见「功能」)。
> 插件的设置命名空间、HTTP 路由与命令名仍是 `dsh-opencode-go-usage`(不变),所以从上游迁移过来无需改动配置;
> 仅 `dsh.bundle.patch` 的 `name` 必须是可解析的包名(scoped),否则 `dsh web` 会在启动时报 `Cannot find package`。

[DSH](https://github.com/deepseek-ai/deepseek-harness)(DeepSeek Harness)插件:监控你的 **OpenCode GO 套餐**额度 —— 10 美元/月的订阅,按模型提供滚动 5 小时 / 每周 / 每月三个窗口的用量限额。

兼容 DSH `0.1.7-rc.1` 与 `0.1.7-rc.2` —— 已写入 `peerDependencies`,由 DSH 校验。
版本矩阵、1.4.0 的改动,以及其他运行时怎么办,见[兼容性](#兼容性)。

## 功能

- **侧边栏小组件**:常驻 DSH Web 侧边栏底部(`sidebar.footer.action` 槽位),三条用量进度条:滚动窗口(5h)、周窗口、月窗口,每条带重置倒计时;侧边栏收起时收缩为紧凑的百分比徽标。
- **时间进度条**:每条用量条下方还有一条时间条,把本窗口的时间轴一分为二——**左侧灰色是已流逝时间**(随时间向右增长),**右侧蓝色是剩余时间**(随时间向左收缩),窗口重置时灰色占满并归零。时间条与用量条**同高同圆角**(5px / 3px),仅颜色与方向不同;灰段与蓝段各自四角圆角,外侧两端与两段相接处都是圆角。灰段与上方用量条的轨道灰使用同一个主题 token(`--dsw-alias-border-l2`),两条灰上下同色;蓝段用 `--dsw-static-deepseek-450`(`#5686fe`)。用量条(消耗了多少额度)与时间条(过去了多少时间)上下对照,可直接看出额度消耗快于还是慢于时间流逝。悬停显示已流逝/剩余时间百分比。
- **`/opencode-go` 聊天命令**:在对话中以文本输出同样的三个窗口数字。
- **同源代理**:host 端注册 `GET /opencode-go/usage`,携带你的 API key 转发到官方 GO 网关。key 永不进入浏览器,也没有 CORS 问题。
- **`x-opencode-session` 修复**:运行时自动为 OpenCode GO 网关的聊天请求注入真实会话 ID(网关对缺失该头的请求返回 400)。不修改 DSH 安装文件,升级不失效。

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
| host(Node) | `lib/index.js` | 注册 `/opencode-go/usage` Web 路由(`ctx.webServer`)与 `/opencode-go` 命令(`ctx.commands`);通过 DSH credentials 解析 key;上游调用带 30s 缓存 |
| 浏览器 | `lib/client.js` | 手写的 `window.__ModuleLoader__.load({ id, factory })` bundle，等待 `sidebar.footer.action` 列表槽就绪后注册，每 60s 轮询同源路由 |

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
| **1.4.0**(当前) | `0.1.7-rc.1`、`0.1.7-rc.2` | 由 loader 读取导出的 `Config` schema;配置取自插件条目(不再调用 `ctx.settings.register`/`settings.get`) | 由 `client-modules` 依据包的 `dsh.client` 声明自动装配 |
| 1.3.3 | `0.1.1-rc.2`、`0.1.2-alpha.2`(即 `0.1.7` 之前的版本线) | `ctx.settings.register` 注册命名空间 + `ctx.settings.get` 读取 | 自托管 bundle 路由 + `webServer.tapIndex` 注入启动图行 |

支持的运行时写进了 `peerDependencies`:

```json
"peerDependencies": { "@deepseek-ai/dsh": "0.1.7-rc.1 || 0.1.7-rc.2" }
```

DSH 会在条目启用前用该范围校验当前运行时：**列出的版本正常加载,未列出的会明确报错**,
而不是半死不活地跑着(`0.1.7` 这条线同时改掉了 settings 接缝与启动清单,1.4.0 正是为迁移
到它而做的)。若运行时不在此列,请改装对应版本的插件(`0.1.7` 之前用 `1.3.3`),或显式接受
风险后重启 DSH:

```bash
dsh plugin allow-version     # 为 name@version 在本 dsh 版本上授予精确版本豁免
```

在受支持版本上还有两点运行时说明:

- **设置页 / 热改 / 旧配置迁移** —— 配置字段标记为 volatile,需要 schemastery ≥ `3.18.4`。DSH 解析插件
  自身依赖时**优先用 profile 里的副本**,若 profile 仍是 `3.18.2`,则不会生成设置页、不能热改,旧的
  `~/.dsh/settings.yaml` 段落也不会被迁移(会留在 `settings.yaml.imported`);插件照常启用,并从
  profile 条目读取配置(见[配置项](#配置项))。
- **小组件** —— 全程无需手工打包或注入 index:host 依据包的 `dsh.client` 声明装配组件,并从
  `/plugins/...` 组合路由提供(见[侧边栏小组件如何加载](#侧边栏小组件如何加载))。

## 环境要求

- 已安装 DSH `0.1.7-rc.1` 或 `0.1.7-rc.2`,且 `web` profile 至少启动过一次(`~/.dsh/profiles/web` 存在)
- Node.js ≥ 18(需要 `fetch`)
- OpenCode GO 订阅及其 API key

## 安装(官方 DSH 流程)

前置:已装 DSH `0.1.7-rc.1` 或 `0.1.7-rc.2`,且 `web` profile 至少启动过一次;Node.js ≥ 18;有 OpenCode GO 订阅。

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

还没发布 npm?从本地目录安装:

```bash
dsh plugin --profile web add /path/to/dsh-opencode-go-usage
```

> 第一次装 DSH 插件?直接看[使用者指南](docs/INSTALL.zh.md),一步步照着做就行。

## 使用

- **小组件**:直接看。侧边栏收起 → 百分比徽标;展开 → 三条进度条 + 重置倒计时。
- **命令**:任意对话里输入 `/opencode-go` 输出三个窗口的文本。

## 配置项

所有字段都是 volatile,因此会出现在 设置 → 插件 → 插件配置 中,改完即时生效、无需重启:

| 键 | 默认 | 说明 |
|---|---|---|
| `apiKeyEnv` | `OPENCODE_GO_API_KEY` | API key 的 credential 引用 / 环境变量名 |
| `baseUrl` | `https://opencode.ai/zen/go` | 网关 base URL |
| `cacheMs` | `30000` | host 端上游缓存 TTL |
| `updateCheck` | `true` | 检查 npm 新版本(组件与命令只提示,插件不会自行升级) |
| `injectSessionHeader` | `true` | 为 GO 网关聊天调用注入运行时 `x-opencode-session` 头 |

> volatile 标记是**带守卫**的:`.volatile()` 从 schemastery 3.18.4 起才有,而 DSH
> 解析插件依赖时**优先用 profile 里的副本**。若 profile 里仍是旧副本(3.18.2),
> 插件照常启用、并从 profile 条目读取配置,只是不会生成设置页、也不能热改——
> 重装插件(或在 profile 里升级 `@deepseek-ai/schemastery`)即可获得。两种情况下
> 都可以直接在 profile patch 里配置:

```yaml
- id: dsh-opencode-go-usage
  config:
    cacheMs: 60000
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

## 开发 / 修改小组件

浏览器端是**手写的 factory bundle**(`window.__ModuleLoader__.load`),因为目前第三方 client 插件还没有公开的构建流水线。它只能 `require()` shell 模块表里的模块(`react`、`react/jsx-runtime` 以及已注册的 client 包)。直接改 `lib/client.js`,然后重启 `dsh web` 并刷新页面 —— bundle 的 revision hash 会变化,shell 会加载新文件。

host 端(`lib/index.js`)的改动只需重启 `dsh web`。

## 常见问题

- **重启后小组件不出现** → 硬刷新页面(`Cmd/Ctrl+Shift+R`);启动图是按页面加载注入的。
- **`/opencode-go/usage` 返回 502 且提示 "no API key"** → 在 `~/.dsh/.credentials.yaml` 配置 key。
- **网关 401/403** → key 无效或订阅过期;检查 credential。
- **小组件显示错误串** → 悬停收起态徽标,或展开态小组件里的错误行。

## License

MIT
