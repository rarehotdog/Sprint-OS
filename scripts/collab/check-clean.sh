#!/usr/bin/env bash
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"

tracked_changes=()
while IFS= read -r line; do
  tracked_changes+=("$line")
done < <(git status --short | awk '$1 != "??" {print $0}')
if [[ ${#tracked_changes[@]} -gt 0 ]]; then
  echo "Tracked changes found. Commit or stash before this step."
  printf '%s\n' "${tracked_changes[@]}"
  exit 1
fi

if [[ "$branch" == codex/* ]]; then
  codex_untracked=()
  while IFS= read -r line; do
    codex_untracked+=("$line")
  done < <(
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
