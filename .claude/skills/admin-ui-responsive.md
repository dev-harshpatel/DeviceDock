# Skill: Admin UI + Responsive Execution

## Trigger
Use when request touches:
- admin page UI
- table/card layout
- theme/color updates

## Mandatory References
- `docs/DESIGN.md`
- `docs/ARCHITECTURE.md`

## Workflow
1. Define desktop + mobile behavior before coding.
2. Reuse existing components/patterns first.
3. Ensure table numeric alignment and scanability.
4. Provide mobile restructuring (cards/stacked rows), not overflow-only.
5. Keep labels explicit for tax/currency-sensitive values.
6. Validate both light and dark theme token compatibility.

## Hard Rules
- Black/Blue/White palette + super-light-blue accents only.
- No new purple accents.
- Must be responsive across mobile/tablet/laptop/desktop.
- Avoid hardcoded colors when global tokens exist.

## Output Checklist
- desktop behavior summary
- mobile behavior summary
- accessibility notes
- theme compatibility note

