# 发布流程（维护者）

> 本文档针对 **fork `Astervolans/dsh-opencode-go-usage`**，发布到 scoped 包名
> **`@astervolans/dsh-opencode-go-usage`**。
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

scope `@astervolans` **已存在**（`https://www.npmjs.com/org/astervolans`），
包名 `@astervolans/dsh-opencode-go-usage` 尚未占用，因此无需新建组织。

核对方式：

```bash
# scope 是否存在
curl -s -o /dev/null -w '%{http_code}\n' https://registry.npmjs.org/-/org/astervolans/user

# 包名是否仍可用（尚未发布时应为 404）
curl -s -o /dev/null -w '%{http_code}\n' 'https://registry.npmjs.org/@astervolans%2Fdsh-opencode-go-usage'
```

若 scope 不存在，去 <https://www.npmjs.com/> → 头像 → **Add Organization**，
Name 填 `astervolans`，Plan 选 **Free / Unlimited public packages**。

`package.json` 已声明 `"publishConfig": { "access": "public" }`，所以 scoped 包会以公开
方式发布，不需要每次加 `--access public`。

## 日常发版

一键（推荐）：

```bash
npm login                     # 首次或凭据过期时。~/.npmrc 里的旧 token 是已吊销的
                              # classic token，npm whoami 返回 401 即需重新登录
./scripts/publish.sh          # 用当前版本发布
./scripts/publish.sh patch    # 或先升版本（minor / major 同理）再发布
```

`scripts/publish.sh` 会依次做：校验已登录 → 可选升版本并提交 →
**校验 `lib/index.js` 的 `NPM_PACKAGE` 与 `package.json` 的 `name` 一致**
（这条最关键，写错会导致更新检查永远查不到新版本）→ 三个 lib 文件语法自检 →
打印打包清单 → `npm publish`。

手动等价步骤：

```bash
npm login
npm whoami            # 应打印你的用户名

npm version patch --no-git-tag-version     # 或 minor / major
git add package.json && git commit -m "chore: release vX.Y.Z"

npm publish           # publishConfig.access=public 已在 package.json 声明

git push origin main
git tag vX.Y.Z && git push origin vX.Y.Z

curl -s https://registry.npmjs.org/@astervolans%2Fdsh-opencode-go-usage/latest | head -c 300
```

发布前自检：

- `lib/` 下的 `NPM_PACKAGE` 常量必须与 `package.json` 的 `name` 一致（更新检查用它查
  registry，写错会永远查不到新版本）；
- `package.json` 的 `files` 决定打包内容（当前为 `lib` + `cordis.patch.yml`），
  改了目录结构要同步；
- `npm pack --dry-run` 看清单（当前 8 个文件 / 约 21 kB）。

## GitHub Packages（自动，无需 token）

每个 Release 也会自动发布到 GitHub Packages，由
[`.github/workflows/release-package.yml`](../.github/workflows/release-package.yml)
完成：`release: created` 触发（另加 `workflow_dispatch` 便于手动重跑），用工作流自带的
`GITHUB_TOKEN`（`packages: write`）发布。**不需要任何 secret**，也不受上游
trusted publisher 按仓库绑定的限制 —— 这是 npmjs 手动发布之外的另一条自动路径。

- **手动重跑**：Actions → Node.js Package → Run workflow。已发布过的版本会被跳过
  （先 `npm view` 查一次，命中就直接 exit 0），不会报红。
- **registry 只在 CI 里映射**：setup-node 按仓库 owner 推导出
  `@astervolans:registry=https://npm.pkg.github.com/`，默认 registry 仍是 npmjs.org。
  仓库里**刻意不放** `.npmrc` —— 那会把这个 scope 的 `npm publish` 也劫持到
  GitHub Packages，破坏下面这套本地 npmjs 发布流程。
- **首次发布后要手动改可见性**：包默认 private，改 public 的位置是
  `https://github.com/users/Astervolans/packages/npm/dsh-opencode-go-usage/settings`
  → Danger Zone → Change visibility。
- GitHub Packages 即使对公开包也**要求认证**（PAT + `read:packages`），所以它更适合
  当镜像/备份，普通用户仍建议走 npmjs.org。
- **可选**：把 npmjs 发布也搬进 CI —— 在 npmjs 上给本包配置 trusted publisher
  （仓库 `Astervolans/dsh-opencode-go-usage`，工作流文件 `release-package.yml`），
  再把仓库变量 `NPMJS_TRUSTED_PUBLISHING` 设为 `true`；那之后 `publish-npmjs`
  作业才会参与发布（默认跳过，不会让 Release 变红）。

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
本 fork 的 `@astervolans/...`。
