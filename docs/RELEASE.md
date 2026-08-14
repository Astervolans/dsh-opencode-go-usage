# 发布流程(维护者)

`npm publish` 已通过 GitHub Actions 自动化。代码提交后,执行一次:

```bash
./scripts/release.sh          # patch(1.1.0 -> 1.1.1)
./scripts/release.sh minor    # minor(1.1.0 -> 1.2.0)
./scripts/release.sh major    # major(1.1.0 -> 2.0.0)
```

脚本自动完成:bump `package.json` 版本 → 提交 → 打 `vX.Y.Z` tag → 推送。
`.github/workflows/npm-publish.yml` 工作流随即自动发布到 npm;tag 与
`package.json` 版本不一致时工作流直接失败(防呆)。

## 一次性配置

1. npmjs.com → Access Tokens → Generate New Token → 类型选 `Automation`
   (自动化令牌可绕过 2FA 验证码,CI 必须用这种)
2. GitHub 仓库 → Settings → Secrets and variables → Actions → New repository
   secret → 名字 `NPM_TOKEN`,粘贴令牌

## 手动兜底(CI 不可用时)

```bash
npm publish   # 需要本地 npm 登录态;2FA 账号会提示输入 OTP
```
