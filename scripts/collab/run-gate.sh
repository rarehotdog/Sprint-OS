#!/usr/bin/env bash
set -euo pipefail

"$(dirname "$0")/verify-ownership.sh"

npm run lint
npm run typecheck
npm run test

echo "Gate passed."
