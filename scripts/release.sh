#!/usr/bin/env bash
# Release helper: bump version, commit, tag, push. GitHub Actions then
# publishes to npm via trusted publishing (OIDC) — no token or secret involved.
# See docs/RELEASE.md for the one-time setup.
#
# Usage:
#   ./scripts/release.sh          # patch: 1.3.0 -> 1.3.1
#   ./scripts/release.sh minor    # minor: 1.3.0 -> 1.4.0
#   ./scripts/release.sh major    # major: 1.3.0 -> 2.0.0
#
# Prerequisites:
#   - repo has an `origin` remote (https, with GitHub auth configured)
#   - npm trusted publisher configured for this repo (see docs/RELEASE.md)
set -euo pipefail

LEVEL="${1:-patch}"
case "$LEVEL" in
  patch|minor|major) ;;
  *) echo "usage: $0 [patch|minor|major]" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

# 1. bump version in package.json (no git tag yet — we tag ourselves)
NEW_VERSION="$(npm version "$LEVEL" --no-git-tag-version)"
echo "→ bump: $NEW_VERSION"

# 2. commit the version bump
git add package.json
git commit -m "chore: release $NEW_VERSION"

# 3. tag and push (the tag triggers the npm publish workflow)
git tag "$NEW_VERSION"
git push origin main
git push origin "$NEW_VERSION"

echo "✓ released $NEW_VERSION — GitHub Actions is publishing to npm now."
echo "  watch: https://github.com/yumusb/dsh-opencode-go-usage/actions"
