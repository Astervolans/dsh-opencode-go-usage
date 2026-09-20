#!/usr/bin/env bash
# 发布 @astervolans/dsh-opencode-go-usage 到 npm。
#
# 为什么是手动发布：上游走 npm Trusted Publishing(OIDC)，但该授权按仓库绑定
# (yumusb/dsh-opencode-go-usage + npm-publish.yml)，fork 不在授权列表内。
# 详见 docs/RELEASE.md。
#
# 用法:
#   ./scripts/publish.sh            # 用 package.json 里的版本直接发布
#   ./scripts/publish.sh patch      # 先升版本(patch/minor/major)再发布
#
# 前置:
#   - 已 `npm login`（发布需要 2FA，必须在本机终端交互完成）
#   - npm scope `@astervolans` 已创建（见 docs/RELEASE.md）
set -euo pipefail

cd "$(dirname "$0")/.."

LEVEL="${1:-}"

# 0. 必须已登录
if ! npm whoami >/dev/null 2>&1; then
  echo "✗ 未登录 npm。先执行: npm login" >&2
  echo "  （发布需要浏览器 2FA，无法在无人值守脚本里完成）" >&2
  exit 1
fi
echo "→ npm 用户: $(npm whoami)"

# 1. 可选：升版本
if [ -n "$LEVEL" ]; then
  case "$LEVEL" in
    patch|minor|major) ;;
    *) echo "usage: $0 [patch|minor|major]" >&2; exit 1 ;;
  esac
  NEW_VERSION="$(npm version "$LEVEL" --no-git-tag-version)"
  git add package.json
  git commit -m "chore: release $NEW_VERSION"
  echo "→ bump: $NEW_VERSION"
fi

VERSION="$(node -p "require('./package.json').version")"
PKG="$(node -p "require('./package.json').name")"

# 2. 回归门禁：lib/index.js 的 NPM_PACKAGE 必须与 package.json 的 name 一致
#    （更新检查用它查 registry，改名后忘了同步会永远查不到新版本）
if ! grep -q "const NPM_PACKAGE = \"$PKG\";" lib/index.js; then
  echo "✗ lib/index.js 的 NPM_PACKAGE 与 package.json 的 name 不一致" >&2
  grep -n 'const NPM_PACKAGE' lib/index.js >&2
  echo "  期望: const NPM_PACKAGE = \"$PKG\";" >&2
  exit 1
fi
echo "→ NPM_PACKAGE 与包名一致: $PKG"

# 3. 语法自检
node --check lib/index.js
node --check lib/client.js
node --check lib/opencode-session.js
echo "→ 语法检查通过"

# 4. 打包清单预览
echo "→ 打包清单:"
npm pack --dry-run 2>&1 | sed -n '/Tarball Contents/,/Tarball Details/p'

# 5. 发布（publishConfig.access=public 已在 package.json 声明）
npm publish

echo ""
echo "✓ 已发布 $PKG@$VERSION"
echo "  https://www.npmjs.com/package/$PKG"
echo ""
echo "记得把代码与 tag 推上去:"
echo "  git push origin main && git tag v$VERSION && git push origin v$VERSION"
echo "  （tag 不会触发 npm 发布——fork 没有 OIDC 授权，工作流已加守卫）"
