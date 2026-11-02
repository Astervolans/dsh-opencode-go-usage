# @astervolans/dsh-opencode-go-usage 使用者指南

给"想用这个插件的人"看的傻瓜式安装步骤。全程不需要写代码。

> 本指南对应 **1.6.0 源码树**:小组件可以选择额度来源——默认跟随 `dsh-opencode-go` 插件的
> **当前账号**,读不到时自动回退到 DSH 内置提供商。1.6.0 **尚未发布到 npm**(没有发布版本、
> 没有 tag),所以请按第 1 步的第二条命令,从本地源码目录安装。

## 前置条件

1. 已经装好 DSH,并且**至少启动过一次** web 界面(这样才会生成 `~/.dsh/profiles/web` 目录)
2. 有一个 **OpenCode GO 套餐**订阅(10 美元/月那种),并且有 API key
3. macOS / Linux / Windows 均可
4. 可选但推荐:同一个 DSH 里装了 **`dsh-opencode-go`** 插件 —— 装了它,小组件默认读取该插件的
   **当前账号**,数字和它自己的设置页一致,切换账号时也会跟着变;没装也能用,只是走内置提供商

> 如果 DSH 还没装,先装 DSH 并启动 web 一次,再继续。

---

## 第 1 步:安装(一条命令)

在终端执行:

```bash
# 1.6.0(本源码树)用本地目录安装:
dsh plugin --profile web add /path/to/dsh-opencode-go-usage
```

> - 如果你装的是**已发布版本**(1.5.0),把路径换成包名:
>   `dsh plugin --profile web add @astervolans/dsh-opencode-go-usage`
> - 如果提示 `pnpm not found`,先执行 `corepack enable` 启用 pnpm 再试
> - 这条命令会自动完成注册,不需要手动改任何配置文件

## 第 2 步:配置你的 API key(必须)

编辑文件 `~/.dsh/.credentials.yaml`,加上一行:

```yaml
OPENCODE_GO_API_KEY: sk-你的key
```

key 在哪拿:登录 [opencode.ai/auth](https://opencode.ai/auth),在账户页面创建 API key。

> 即使走默认的 `dsh-opencode-go` 来源,这一步也要做:一旦探测不到该插件(或它读取失败),
> 插件会自动回退到内置提供商,而内置路径正是用这个 credential 去查额度。

## 第 3 步:重启 DSH

**完全退出 dsh web 进程,再重新启动**(不是刷新页面)。

## 第 4 步:验证

- 侧边栏**底部**应该出现一个 "OpenCode GO" 小组件,显示三条用量进度条
- 如果装了 `dsh-opencode-go`,标题会显示当前账号,形如 `OpenCode GO · 账号名`
- 如果小组件上出现一个小 **内置** 徽标,说明这次用的是 DSH 内置提供商(把鼠标停在徽标上看原因)
- 在对话里输入 `/opencode-go`,会输出三个窗口的用量百分比
- 命令行验证:`curl http://127.0.0.1:3080/opencode-go/usage` 返回 JSON 即成功;里面的
  `source` 是实际来源(`opencode-go` / `builtin`),`account` 是当前账号,`fallback` 说明是否发生了回退

## 第 5 步(可选):选择额度来源

默认值(`opencode-go`:优先跟随 `dsh-opencode-go`)不需要任何设置。想确认或切换:

1. 打开侧边栏的 **「插件」** 面板
2. 找到 **`@astervolans/dsh-opencode-go-usage`** 的卡片,点开它的**配置页**
3. 在两个选项里选一个,然后点**保存**:
   - **优先 dsh-opencode-go(当前账号)** —— 默认;读不到时自动回退内置
   - **DSH 内置提供商** —— 始终用 `baseUrl` + `/v1/usage`,完全不探测 `dsh-opencode-go`
4. 页面上还能看到实时状态:`dsh-opencode-go` 是否被检测到、版本、当前账号、实际生效的来源、
   回退原因

这个配置页注册在 DSH 的 `plugins.bundle.config` 槽位(也就是「插件」面板里的应用包卡片),
它和 **设置 → 插件 → 插件配置** 里的表单改的是同一份配置:字段名 `quotaSource`,任一处保存都
即时生效,不需要重启 DSH。保存时如果提示冲突(revision 过期,说明配置在别处被改过),先点
**重新加载**再保存。

> 找不到这个配置页,或页面提示无法描述设置?说明你的 DSH 运行时不提供该槽位、或拿不到设置
> 描述符——直接去 设置 → 插件 → 插件配置 里改 `quotaSource`,或在 profile 里给条目打 patch:
>
> ```yaml
> - id: dsh-opencode-go-usage
>   config:
>     quotaSource: builtin
> ```

**回退是正常的,不是报错**:没装 `dsh-opencode-go`、它被禁用、版本不兼容,或它自己读取失败时,
小组件会安静地改用内置提供商,只在标题上加一个「内置」徽标并在提示里写原因。`/opencode-go/usage`
的 `fallback.reason` 会给出具体原因:

| `fallback.reason` | 含义 | 怎么办 |
|---|---|---|
| `not-installed` | 当前 profile 里没有 `dsh-opencode-go` 的实时条目 | 装同一个 profile,或重启 `dsh web` 让它加载 |
| `entry-disabled` | 条目存在但被禁用 | 在 设置 → 插件 里启用 |
| `service-unavailable` | 该插件没有提供用量服务(通常是版本太旧) | 升级 `dsh-opencode-go` |
| `read-failed` | 该插件自己报错(例如它的当前账号没 key) | 看 `fallback.message`,先修它那边 |
| `invalid-response` | 该插件返回的数据结构不对 | 升级/反馈给 `dsh-opencode-go` |

---

## 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 侧边栏没有小组件 | 没重启 / 没刷新页面 | 完全重启 dsh web,再 Cmd/Ctrl+Shift+R 刷新 |
| `/opencode-go` 提示 no API key | key 没配 | 检查 `~/.dsh/.credentials.yaml` 里的 `OPENCODE_GO_API_KEY` |
| 装了 `dsh-opencode-go` 但仍显示「内置」 | 探测失败,插件自动回退了 | 看 `/opencode-go/usage` 的 `fallback.reason`,按上表处理;不想探测就设 `quotaSource: builtin` |
| 小组件标题没有账号名 | `dsh-opencode-go` 缺失(回退),或它的当前账号没有名字 | 看接口里的 `account.name` 确认,属于正常显示 |
| 找不到额度来源的配置页 | 运行时不提供 `plugins.bundle.config` 槽位 | 用 设置 → 插件 → 插件配置 里的 `quotaSource`,或 profile patch |
| 保存时提示冲突 | 配置在别处被改过(`expectedRevision` 过期) | 点「重新加载」再保存 |
