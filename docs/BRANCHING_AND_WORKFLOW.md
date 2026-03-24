# Branching Strategy & Workflow

This document defines the Git branching model for **b2bmobiles.ca** (Stoq) so that production stays stable and all changes are tested before going live.

---

## Branch overview

| Branch          | Purpose                                                    | Deploy target                                              |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| **`main`**      | Production. Only tested, release-ready code.               | b2bmobiles.ca (production)                                 |
| **`dev`**       | Integration & testing. All feature work merges here first. | Optional: staging URL (e.g. b2bmobiles-staging.vercel.app) |
| **`feature/*`** | Single feature or fix. Never merge directly to `main`.     | Local only                                                 |

---

## Rules

1. **`main` = production**

   - Only merge from `dev` after testing.
   - Prefer protected branch + required reviews if you use GitHub/GitLab.

2. **`dev` = integration**

   - All feature branches merge into `dev` first.
   - Run tests and manual checks on `dev` (or staging) before promoting to `main`.

3. **Feature branches**

   - Create from `dev`: `git checkout dev && git pull && git checkout -b feature/your-feature-name`.
   - Merge back into `dev` only (never directly into `main`).

4. **Hotfixes (optional)**
   - For urgent production-only fixes you can use `hotfix/*` from `main`, then merge to both `main` and `dev` so `dev` stays in sync.

---

## Workflow diagram

```
                    feature/add-report
                          │
                          ▼
    main ───────────► dev ◄──────── feature/fix-checkout
       ▲                 │
       │                 │  (test on dev / staging)
       │                 │
       └─────────────────┘
            merge dev → main
            (after approval)
```

---

## Step-by-step workflow

### Starting a new feature

```bash
# 1. Ensure dev is up to date
git checkout dev
git pull origin dev

# 2. Create feature branch (use a short, descriptive name)
git checkout -b feature/inventory-export
# or:  fix/checkout-button, feat/order-filters, etc.

# 3. Do your work, commit often
git add .
git commit -m "feat: add CSV export for inventory"

# 4. Push and open a Pull Request (PR) **into dev**
git push -u origin feature/inventory-export
# Then in GitHub/GitLab: Create PR: feature/inventory-export → dev
```

### Merging a feature into dev

- Merge (or squash-merge) the feature branch **into `dev`**.
- Delete the feature branch after merge.
- Run your test suite and/or manual testing on the `dev` deployment.

### Releasing to production (dev → main)

- When `dev` is stable and tested:
  1. Open a PR: **`dev` → `main`**.
  2. Review changes (and run any final checks).
  3. Merge `main`.
  4. Production (b2bmobiles.ca) will redeploy from `main` (e.g. Vercel auto-deploy).

```bash
# Optional: tag releases on main for history
git checkout main
git pull origin main
git tag -a v1.2.0 -m "Release 1.2.0"
git push origin v1.2.0
```

### Keeping feature branch up to date with dev

If `dev` has moved on while you work:

```bash
git checkout feature/your-branch
git fetch origin
git merge origin/dev
# fix conflicts if any, then push
git push
```

---

## Branch naming

- **Features:** `feature/short-description` (e.g. `feature/order-export`)
- **Fixes:** `fix/short-description` (e.g. `fix/login-redirect`)
- **Hotfixes:** `hotfix/short-description` (e.g. `hotfix/payment-error`)

Use lowercase and hyphens; keep names short and clear.

---

## One-time setup: create `dev` and protect `main`

If you only have `main` today:

```bash
# Create dev from current main (do this once)
git checkout main
git pull origin main
git checkout -b dev
git push -u origin dev
```

Then in your Git host (e.g. GitHub):

- **Settings → Branches → Add rule for `main`:**
  - Require a pull request before merging.
  - Optionally: require status checks, restrict who can push.
- Optionally add a rule for `dev` (e.g. require PR from `feature/*`).

---

## Summary

- **Feature work:** always in a branch → merge into **`dev`** → test.
- **Production:** merge **`dev`** into **`main`** only when ready.
- **Production DB:** use a **separate** Supabase project; see [ENVIRONMENTS_AND_SUPABASE.md](./ENVIRONMENTS_AND_SUPABASE.md).
