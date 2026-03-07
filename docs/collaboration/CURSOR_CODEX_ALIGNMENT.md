# Cursor-Codex Alignment Playbook (Single Workspace)

## Branch topology
- `codex/task-1-4-foundation-contracts`: shared base branch.
- `cursor/task-5-6-ui-solve-quick`: UI branch. Rebase target is always foundation.
- `codex/task-7-8-review-core`: API and review-core branch.

## Ownership map
- Codex owned paths: `src/lib/**`, `src/app/api/**`, `supabase/**`, `tests/**`.
- Cursor owned paths: `src/app/**` (except `src/app/api/**`), `src/components/**`.
- Shared paths: `package.json`, `src/app/layout.tsx`, `src/app/page.tsx`.

## Turn protocol
1. Start turn with a clean tree for your branch policy: `scripts/collab/check-clean.sh`.
2. Work only in your owned paths.
3. End turn with at least one commit.
4. Run local gate before handoff: `scripts/collab/run-gate.sh`.

Notes:
- In single-workspace mode, Codex may ignore Cursor-only untracked files.
- Codex must still keep tracked changes clean before handoff.

Gate modes:
- Local gate (default): ownership + Codex-owned lint/typecheck + Codex tests.
- Strict gate: ownership + full `lint/typecheck/test`.
- Use strict gate at integration time only.

## Cursor sync rule
- On `cursor/task-5-6-ui-solve-quick` only:
- `scripts/collab/sync-cursor.sh`

## Integration sequence
- Build integration branch with fixed order:
- `scripts/collab/prepare-integration.sh`
- Merge order is always foundation -> cursor -> review-core.
- Integration script runs strict gate automatically.

## Contract freeze
- UI must import shared contracts and not redefine payload shapes.
- Frozen contract files:
  - `src/lib/types.ts`
  - `src/lib/contracts/report-contracts.ts`
  - `src/app/api/**`
