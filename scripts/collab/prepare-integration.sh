#!/usr/bin/env bash
set -euo pipefail

integration_branch="integration/cursor-codex"
foundation_branch="codex/task-1-4-foundation-contracts"
cursor_branch="cursor/task-5-6-ui-solve-quick"
review_branch="codex/task-7-8-review-core"
workspace_root="$(git rev-parse --show-toplevel)"
tmp_base="${TMPDIR:-/tmp}"
integration_dir="$tmp_base/gmat-integration-$(date +%Y%m%d%H%M%S)"

"$(dirname "$0")/check-clean.sh"

git worktree add -f "$integration_dir" "$foundation_branch"
trap 'git worktree remove "$integration_dir" --force >/dev/null 2>&1 || true' EXIT

pushd "$integration_dir" >/dev/null
git checkout -B "$integration_branch" "$foundation_branch"

git merge --no-ff "$cursor_branch" -m "merge: cursor ui"
git merge --no-ff "$review_branch" -m "merge: codex review-core"

export PATH="$workspace_root/node_modules/.bin:$PATH"
"$workspace_root/scripts/collab/run-gate.sh" strict
popd >/dev/null

trap - EXIT
echo "Integration branch '$integration_branch' validated in: $integration_dir"
echo "If you want to keep it for inspection, no action is needed."
echo "To clean it later: git worktree remove '$integration_dir' --force"
