#!/usr/bin/env bash
set -euo pipefail

integration_branch="integration/cursor-codex"
foundation_branch="codex/task-1-4-foundation-contracts"
cursor_branch="cursor/task-5-6-ui-solve-quick"
review_branch="codex/task-7-8-review-core"

current_branch="$(git rev-parse --abbrev-ref HEAD)"
"$(dirname "$0")/check-clean.sh"

git checkout -B "$integration_branch" "$foundation_branch"

git merge --no-ff "$cursor_branch" -m "merge: cursor ui"
git merge --no-ff "$review_branch" -m "merge: codex review-core"

npm run lint
npm run typecheck
npm run test

echo "Integration branch '$integration_branch' is ready."
echo "Return to previous branch with: git checkout $current_branch"
