#!/usr/bin/env bash
set -euo pipefail

current_branch="$(git rev-parse --abbrev-ref HEAD)"

if [[ "$current_branch" != "cursor/task-5-6-ui-solve-quick" ]]; then
  echo "sync-cursor.sh must run on cursor/task-5-6-ui-solve-quick (current: $current_branch)."
  exit 1
fi

"$(dirname "$0")/check-clean.sh"

git rebase codex/task-1-4-foundation-contracts

echo "Cursor branch synced to foundation."
