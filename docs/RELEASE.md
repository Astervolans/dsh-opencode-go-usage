# 发布流程（维护者）

> 本文档针对 **fork `Astervolans/dsh-opencode-go-usage`**，发布到 scoped 包名
> **`@asterdolans/dsh-opencode-go-usage`**。
>
> 上游 `yumusb/dsh-opencode-go-usage` 发布的是无 scope 的 `dsh-opencode-go-usage`，
> 该包名不属于本 fork，本 fork **无法**也**不应**向其发布。

## 为什么不用上游的 OIDC 流程

上游走 npm **Trusted Publishing（OIDC）**：GitHub Actions 用临时身份发版，无需长期 token。
但 Trusted Publisher 的授权是**按仓库**绑定的（上游绑定的是 `yumusb` + `dsh-opencode-go-usage`
+ `npm-publish.yml`）。fork 不在授权列表里，推 `v*` tag 只会得到失败的工作流
（`.github/workflows/npm-publish.yml` 在 fork 中保持原样，即为历史留存）。

因此本 fork 采用**手动发布**（唯一不受 OIDC 绑定限制的路径）。

## 一次性配置

以你的 npm 账号创建 scope `@asterdolans`（免费，公开包）：

1. 登录 <https://www.npmjs.com/>；
2. 右上头像 → **Add Organization**；
3. Name 填 `asterdolans`，Plan 选 **Free / Unlimited public packages**；
4. 创建后确认 `https://www.npmjs.com/org/asterdolans` 可访问。

`package.json` 已声明 `"publishConfig": { "access": "public" }`，所以 scoped 包会以公开
方式发布，不需要每次加 `--access public`。

## 日常发版

```bash
# 0. 登录（浏览器授权 + 2FA）。~/.npmrc 里的旧 token 是已吊销的 classic token，
#    npm whoami 返回 401 就说明它已经死了，必须重新登录。
npm login
npm whoami            # 应打印你的用户名

# 1. 升版本号（提交 + 打 tag，不推送到上游）
npm version patch --no-git-tag-version     # 或 minor / major
git add package.json && git commit -m "chore: release vX.Y.Z"

# 2. 发布
npm publish

# 3. 推送代码与 tag（tag 不会触发发布——fork 没有 OIDC 授权）
git push origin main
git tag vX.Y.Z && git push origin vX.Y.Z

# 4. 核对
curl -s https://registry.npmjs.org/@asterdolans%2Fdsh-opencode-go-usage/latest | head -c 300
```

发布前自检：

- `lib/` 下的 `NPM_PACKAGE` 常量必须与 `package.json` 的 `name` 一致（更新检查用它查
  registry，写错会永远查不到新版本）；
- `package.json` 的 `files` 决定打包内容（当前为 `lib` + `cordis.patch.yml`），
  改了目录结构要同步；
- 装包验证：`npm pack --dry-run` 看清单。

## 为什么不用 NPM_TOKEN

- npm 已于 2025-11-19 **永久吊销全部 classic token**，生成入口同时关闭 ——
  已无法再创建「Automation 类型 token」。
- granular token 的写权限最长 90 天；2026-07-31 起 bypass-2FA 的 granular token
  又被进一步限制。secret 方案必须定期轮换，不换就会在某天突然发不出去。
- 本机 `~/.npmrc` 里的那个 token 就处于这个状态：`npm whoami` 直接 401。

**注意**：npm 发布需要 2FA（浏览器 WebAuthn），无法在无人值守的脚本/Agent 里完成，
必须由维护者本人在终端执行 `npm login` + `npm publish`。

## 与上游的同步

```bash
git remote add upstream https://github.com/yumusb/dsh-opencode-go-usage.git   # 已配置
git fetch upstream && git log --oneline HEAD..upstream/main    # 查看上游新提交
git cherry-pick <sha>                                          # 按需挑选
```

cherry-pick 上游提交时注意：上游的 `package.json` 是**无 scope 包名**，冲突时应保留
本 fork 的 `@asterdolans/...`。
