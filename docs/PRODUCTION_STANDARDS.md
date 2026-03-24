# Production Standards (b2bmobiles.ca)

This document ties together branching, environments, and safe deployment so the live site stays stable and predictable.

---

## Quick links

- **[Branching & workflow](./BRANCHING_AND_WORKFLOW.md)** — `main` (production), `dev` (integration), feature branches; how to merge and release.
- **[Environments & Supabase](./ENVIRONMENTS_AND_SUPABASE.md)** — Separate Supabase projects for dev and prod; env vars for local and Vercel.

---

## Core principles

1. **Production (`main`) is sacred** — Only code that has been merged into `dev`, tested, and then explicitly merged into `main` goes live. No direct commits to `main` for features.
2. **Separate data** — Development and staging use a **dev** Supabase project; production uses a **production** Supabase project. Never point production at the dev DB.
3. **Migrations are intentional** — Test migrations on dev first; apply to production only when the release is ready and you’re sure of the SQL.

---

## Pre-deployment checklist (before merging dev → main)

Use this before every production release.

### Code & Git

- [ ] All work for this release is merged into `dev`.
- [ ] Tests (if any) pass on `dev`.
- [ ] You’ve done a quick manual smoke test on the **staging / dev** deploy (login, critical flows).
- [ ] No debug code, `console.log` spam, or temporary env vars that shouldn’t be in prod.
- [ ] PR is open: **`dev` → `main`** and (if applicable) reviewed.

### Database

- [ ] Any new migrations have been run and verified on **dev** Supabase first.
- [ ] Plan for production: run the same migration(s) in **production** Supabase (e.g. SQL Editor or a one-off script with prod env) at or right after deploy.
- [ ] You are **not** using production DB credentials locally or in Preview; production credentials exist only in Vercel **Production** environment.

### Config & secrets

- [ ] Vercel **Production** env has the correct **production** Supabase URL, anon key, and service role key.
- [ ] `NEXT_PUBLIC_SITE_URL` in production is `https://b2bmobiles.ca` (or your real production URL).
- [ ] No dev/staging URLs or dev API keys in Vercel Production env.

### After merging to main

- [ ] Vercel has deployed from `main` successfully (check Vercel dashboard).
- [ ] If this release included a migration, it has been applied to the **production** Supabase project.
- [ ] Quick smoke check on live site: login, one critical path (e.g. place order or view inventory).

---

## Branch → environment map

| Git branch  | Vercel environment | Supabase                                           | URL (example)                   |
| ----------- | ------------------ | -------------------------------------------------- | ------------------------------- |
| `main`      | Production         | Main project (production)                          | https://b2bmobiles.ca           |
| `dev`       | Preview            | Persistent branch or dev project                   | e.g. …-git-dev-….vercel.app     |
| `feature/*` | Preview            | Preview branch (Supabase Branching) or dev project | e.g. …-git-feature-….vercel.app |

- **With Supabase Branching:** Production = main project; each PR gets a Supabase preview branch; Vercel receives that branch’s env vars automatically. See [ENVIRONMENTS_AND_SUPABASE.md](./ENVIRONMENTS_AND_SUPABASE.md).
- **With two projects:** Set Production env vars to the production Supabase project and Preview to the dev project in Vercel.

---

## Safe migration workflow

**If using Supabase Branching:** Add migration files under `supabase/migrations/` and push to a branch; open a PR. Supabase runs migrations on the preview branch. After review, merge to `main`; if “Deploy to production” is enabled, Supabase applies migrations to the main project. No manual production migration step needed.

**If using two separate projects:**

1. **Write** migration SQL (in `supabase/migrations/` or a one-off file).
2. **Run on dev** — Apply it in the **dev** Supabase project (SQL Editor or `npm run migrate` with dev env). Verify app still works.
3. **Merge to `main`** — Include the migration file in the same release that needs the new schema.
4. **Apply to production** — After deploying from `main`, run the **same** migration in the **production** Supabase project (e.g. SQL Editor).
5. **Never** run untested or destructive SQL against production first.

---

## If something goes wrong in production

- **Code bug:** Revert the merge on `main` (or deploy a hotfix from a branch that’s merged to `main`), then fix properly on `dev` and release again.
- **Bad migration:** Fix forward with a new migration on production if possible; otherwise restore from Supabase backups (Supabase Dashboard → Database → Backups) and then fix the migration and re-apply carefully.
- **Wrong env (e.g. prod pointed at dev DB):** Fix env vars in Vercel Production immediately and redeploy; no code change needed if it was only config.

---

## Optional: tagging releases

For a clear history of what was in each release:

```bash
git checkout main
git pull origin main
git tag -a v1.0.1 -m "Release 1.0.1: inventory export and checkout fix"
git push origin v1.0.1
```

Use semantic versioning (e.g. `v1.2.3`) if you like; otherwise a date tag like `release/2025-02-18` is fine.

---

## Summary

- **Branching:** Feature → `dev` → test → then `dev` → `main` for release. See [BRANCHING_AND_WORKFLOW.md](./BRANCHING_AND_WORKFLOW.md).
- **Environments:** Two Supabase projects (dev + prod); correct env vars per environment. See [ENVIRONMENTS_AND_SUPABASE.md](./ENVIRONMENTS_AND_SUPABASE.md).
- **Releases:** Use the checklist above before every `dev` → `main` merge and after each production deploy.

Following these standards keeps b2bmobiles.ca predictable and safe as you add features and changes.
