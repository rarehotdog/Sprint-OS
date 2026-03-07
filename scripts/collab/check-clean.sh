#!/usr/bin/env bash
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"

mapfile -t tracked_changes < <(git status --short | awk '$1 != "??" {print $0}')
if [[ ${#tracked_changes[@]} -gt 0 ]]; then
  echo "Tracked changes found. Commit or stash before this step."
  printf '%s\n' "${tracked_changes[@]}"
  exit 1
fi

if [[ "$branch" == codex/* ]]; then
  mapfile -t codex_untracked < <(
    git ls-files --others --exclude-standard \
      | grep -E '^(src/lib/|src/app/api/|supabase/|tests/|scripts/collab/|docs/collaboration/|package.json|src/app/layout.tsx|src/app/page.tsx)' \
      || true
  )

  if [[ ${#codex_untracked[@]} -gt 0 ]]; then
    echo "Untracked files in Codex-owned/shared paths found."
    printf '%s\n' "${codex_untracked[@]}"
    exit 1
  fi
fi

echo "Working tree is clean for branch policy."
