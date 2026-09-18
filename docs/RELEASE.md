# 发布流程（维护者）

发版走 GitHub Actions，用 npm 的 **Trusted Publishing（OIDC）**，不需要任何 token 或 secret。

## 一次性配置

本包在 npm 上已经存在（`1.3.0` 是手动发的），所以可以直接配置 Trusted Publisher ——
不像全新包那样必须先手动发一版。

打开 `https://www.npmjs.com/package/dsh-opencode-go-usage` → **Settings** → **Trusted Publisher** → **GitHub Actions**：

| 字段 | 值 |
| --- | --- |
| Organization or user | `yumusb` |
| Repository | `dsh-opencode-go-usage` |
| Workflow filename | `npm-publish.yml` |
| Allowed actions | Allow `npm publish` |

保存后就不需要再管了。顺手把仓库里的 `NPM_TOKEN` secret 删掉
（repo → Settings → Secrets and variables → Actions）：迁移后它没有任何消费者，
留着只是一个随时可能被误用的失效凭据。

## 日常发版

```bash
./scripts/release.sh          # patch：1.3.0 → 1.3.1
./scripts/release.sh minor    # minor：1.3.0 → 1.4.0
./scripts/release.sh major    # major：1.3.0 → 2.0.0
```

脚本依次做：升 `package.json` 版本 → 提交 → 打 `vX.Y.Z` tag → 推送。tag 推上去后
`.github/workflows/npm-publish.yml` 自动发布。

工作流有两道防呆：

- tag 和 `package.json` 版本不一致时直接失败
- 该版本已经在 npm 上时跳过（所以补推 1.1.0–1.3.0 这些手动发布的旧 tag 不会红叉）

## 手动兜底

CI 不可用时，本地发布**没有**无 token 方案，只能走浏览器登录：

```bash
npm login                      # 浏览器授权 + 2FA
npm whoami                     # 确认登录成功
npm publish --access public
```

本机 npm 需 ≥ 11.5.1（当前 12.0.2 满足）。可直接查 `~/.npmrc` 里的旧 token 是否
还有效：`npm whoami` 返回 401 就说明它已经死了。

## 为什么不用 NPM_TOKEN

- npm 已于 2025-11-19 **永久吊销全部 classic token**，生成入口同时关闭 ——
  本文件早期版本让人去生成的「Automation 类型 token」已经无法再创建。
- granular token 的写权限最长 90 天；2026-07-31 起 bypass-2FA 的 granular token
  又被进一步限制。secret 方案必须定期轮换，不换就会在某天突然发不出去。
- 本机 `~/.npmrc` 里的那个 token 现在就处于这个状态：`npm whoami` 直接 401，
  所以文档里的「手动兜底 `npm publish`」在迁移前是走不通的。

OIDC 没有任何长期凭据：GitHub 给工作流签发一个临时身份，npm 校验「确实是这个仓库的
这条工作流」，然后签发短时凭据。顺带还会自动生成 provenance 签名证明
（同机制的 `dsh-opencode-go-plus@1.0.8` 已带上 attestation）。
