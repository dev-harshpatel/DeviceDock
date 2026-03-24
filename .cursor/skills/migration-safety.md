# Cursor Skill: Migration Safety

## Use for
- schema changes
- backfills/data fixes
- inventory financial column updates

## Steps
1. Define scope + impacted rows.
2. Write additive migration only.
3. Add guarded conditions (`WHERE`).
4. Keep operation idempotent where possible.
5. Prepare pre/post validation SQL.
6. Provide rollback approach notes.

## Required Output
- migration path
- risk summary
- pre-check query
- post-check query
- rollback note

