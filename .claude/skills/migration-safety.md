# Skill: Migration Safety

## Trigger
Use when request touches:
- Supabase schema changes
- data corrections/backfills
- financial fields (`purchase_price`, `price_per_unit`, `selling_price`, `hst`, `quantity`)

## Mandatory Inputs
- target tables
- affected columns
- rollback approach
- pre/post validation queries

## Workflow
1. Define exact risk and blast radius.
2. Create additive migration only (never edit old migrations).
3. Use guarded `WHERE` clauses.
4. Prefer idempotent updates.
5. Include `updated_at` updates only when required.
6. Add pre-validation SQL and post-validation SQL.
7. Document expected row counts before running in prod.

## Hard Rules
- No destructive commands without explicit approval.
- No broad update without scope guards.
- No assumptions about nullability; validate first.

## Output Checklist
- migration file path
- why it is safe
- pre-check query
- post-check query
- rollback notes

