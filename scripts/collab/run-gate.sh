#!/usr/bin/env bash
set -euo pipefail

mode="${1:-local}"

"$(dirname "$0")/verify-ownership.sh"

if [[ "$mode" == "strict" ]]; then
  npm run lint
  npm run typecheck
  npm run test
  echo "Strict gate passed."
  exit 0
fi

npm run lint -- --dir src/lib --dir src/app/api --dir tests
npx tsc -p tsconfig.codex.json --noEmit
npm run test -- tests/report-contracts.test.ts tests/review-queue.test.ts tests/solve-api.test.ts

echo "Local gate passed."
