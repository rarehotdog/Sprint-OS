#!/usr/bin/env bash
set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"
mapfile -t changed_files < <("$(dirname "$0")/_changed_files.sh")

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No changed files. Ownership check skipped."
  exit 0
fi

is_shared_file() {
  case "$1" in
    package.json|src/app/layout.tsx|src/app/page.tsx)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_codex_allowed() {
  case "$1" in
    src/lib/*|src/app/api/*|supabase/*|tests/*|scripts/collab/*|docs/collaboration/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_cursor_allowed() {
  case "$1" in
    src/components/*|src/app/*)
      [[ "$1" == src/app/api/* ]] && return 1
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_contract_frozen_path() {
  case "$1" in
    src/lib/types.ts|src/lib/contracts/report-contracts.ts|src/app/api/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

violations=()

for file in "${changed_files[@]}"; do
  if is_shared_file "$file"; then
    continue
  fi

  if [[ "$branch" == codex/* ]]; then
    if ! is_codex_allowed "$file"; then
      violations+=("$file")
    fi
    continue
  fi

  if [[ "$branch" == cursor/* ]]; then
    if ! is_cursor_allowed "$file"; then
      violations+=("$file")
      continue
    fi

    if is_contract_frozen_path "$file"; then
      violations+=("$file")
    fi
    continue
  fi
done

if [[ "$branch" != codex/* && "$branch" != cursor/* ]]; then
  echo "Branch '$branch' has no ownership policy. Check skipped."
  exit 0
fi

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "Ownership check failed on branch '$branch'."
  printf ' - %s\n' "${violations[@]}"
  exit 1
fi

echo "Ownership check passed on branch '$branch'."
