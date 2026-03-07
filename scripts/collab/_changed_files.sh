#!/usr/bin/env bash
set -euo pipefail

{
  git diff --name-only
  git diff --name-only --cached
  if [[ "${INCLUDE_UNTRACKED:-0}" == "1" ]]; then
    git ls-files --others --exclude-standard
  fi
} | awk 'NF' | sort -u
