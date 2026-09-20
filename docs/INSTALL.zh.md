# @asterdolans/dsh-opencode-go-usage 使用者指南

给"想用这个插件的人"看的傻瓜式安装步骤。全程不需要写代码。

## 前置条件

1. 已经装好 DSH,并且**至少启动过一次** web 界面(这样才会生成 `~/.dsh/profiles/web` 目录)
2. 有一个 **OpenCode GO 套餐**订阅(10 美元/月那种),并且有 API key
3. macOS / Linux / Windows 均可

> 如果 DSH 还没装,先装 DSH 并启动 web 一次,再继续。

---

## 第 1 步:安装(一条命令)

在终端执行:

```bash
dsh plugin --profile web add @asterdolans/dsh-opencode-go-usage
```

> - 如果提示 `pnpm not found`,先执行 `corepack enable` 启用 pnpm 再试
> - 如果还没发布到 npm,把包名换成插件源码目录的绝对路径,例如:
>   `dsh plugin --profile web add ~/dsh-opencode-go-usage`
> - 这条命令会自动完成注册,不需要手动改任何配置文件

## 第 2 步:配置你的 API key(必须)

编辑文件 `~/.dsh/.credentials.yaml`,加上一行:

```yaml
OPENCODE_GO_API_KEY: sk-你的key
```

key 在哪拿:登录 [opencode.ai/auth](https://opencode.ai/auth),在账户页面创建 API key。

## 第 3 步:重启 DSH

**完全退出 dsh web 进程,再重新启动**(不是刷新页面)。

## 第 4 步:验证

- 侧边栏**底部**应该出现一个 "OpenCode GO" 小组件,显示三条用量进度条
- 在对话里输入 `/opencode-go`,会输出三个窗口的用量百分比
- 命令行验证:`curl http://127.0.0.1:3080/opencode-go/usage` 返回 JSON 即成功

---

## 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 侧边栏没有小组件 | 没重启 / 没刷新页面 | 完全重启 dsh web,再 Cmd/Ctrl+Shift+R 刷新 |
| `/opencode-go` 提示 no API key | key 没配 | 检查 `~/.dsh/.credentials.yaml` 里的 `OPENCODE_GO_API_KEY` |

