# Environments & Supabase (Dev vs Production)

Keep **development** and **production** data separate. You can do that either with **Supabase Branching** (one project, branches; recommended) or with **two separate Supabase projects**.

---

## Why separate databases?

- **Production** (b2bmobiles.ca) must stay stable; you never run experiments or destructive scripts on it.
- **Development/staging** is for testing migrations, seeds, and new features without risking production.

---

## Option A: Supabase Branching (recommended)

Supabase **Branching** uses a single project: your **main** project is production, and you create **branches** (preview or persistent) that each get their own database instance and API credentials. This fits your Git workflow (main / dev / feature branches) and works with Vercel.

### How it fits your workflow

| Git branch          | Supabase branch type         | What happens                                                                        |
| ------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| **main**            | Main project (production)    | Live site (b2bmobiles.ca) uses this.                                                |
| **dev**             | Persistent branch (optional) | Long-lived staging; own URL/keys.                                                   |
| **feature/\*** (PR) | Preview branch (ephemeral)   | One branch per PR; migrations run automatically; Vercel gets the branch’s env vars. |

- **Preview branches** are created when you open a PR; they’re tied to that PR and can be paused/deleted when the PR is closed.
- **Persistent branches** (e.g. `dev`) you create once; they stay until you delete them (good for staging).
- When you **merge to main** in Git, you can enable **Deploy to production** so Supabase applies migrations to the main project automatically.

### What you get with Branching

- One Supabase project (your current production project).
- Migrations in `supabase/migrations` run automatically on each branch (and on production when you merge to main, if you enable it).
- With the **Vercel integration**, Supabase injects the correct branch URL and keys into Vercel for **Preview** deployments (per PR), so you don’t manage two sets of env vars by hand for previews.
- Optional `config.toml` and `seed.sql` for branch-specific config and seeding (e.g. staging seed).

---

## Setup: Supabase Branching + GitHub + Vercel

### 1. Prepare your repo (you already have this)

- Your migrations live under `supabase/migrations/` and are committed to Git.
- Your app uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (no code change needed).

### 2. Enable Branching on your Supabase project

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → select your **production** project (the one used by b2bmobiles.ca).
2. Go to **Project Settings** → **Integrations** (or the Branching section in the dashboard).
3. Enable **Branching** for the project.

### 3. Connect GitHub

1. In the same Integrations area, set up **GitHub integration**.
2. Authorize Supabase and connect the repository that contains this app.
3. Set the **path to the Supabase directory** (e.g. `supabase` if the folder is at the repo root).
4. Enable **Automatic branching** so Supabase creates a branch when you create a Git branch / open a PR (and optionally “Supabase changes only” so branches are created only when files under `supabase/` change).
5. Optionally enable **Deploy to production** so that when you merge into your production Git branch (e.g. `main`), Supabase runs the deployment workflow (migrations, etc.) on the main project.

### 4. Connect Vercel

1. Install the [Supabase integration for Vercel](https://vercel.com/integrations/supabase) and connect it to this Vercel project.
2. Ensure the project uses the **Vercel GitHub integration** (deployments from Git). Branching with Vercel depends on it.
3. Link this Vercel project to the same Supabase project (the one where you enabled Branching).

After this, when you open a **Pull Request**, Supabase creates a preview branch and pushes that branch’s environment variables to Vercel for the PR’s preview deployment. Vercel may redeploy the PR after Supabase sets the vars to avoid race conditions.

### 5. Production env vars in Vercel

- In Vercel → **Settings** → **Environment Variables**, set for **Production** only:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` = your **main** (production) Supabase project’s values.
  - `NEXT_PUBLIC_SITE_URL` = `https://b2bmobiles.ca`.
- Do **not** set these for Preview if you use Supabase Branching for previews; Supabase will inject the branch-specific values for PR previews.

### 6. Local development

- For local work, use either:
  - A **persistent Supabase branch** (e.g. `dev`): create it in the dashboard or CLI, then copy its API URL and keys into `.env` / `.env.local`, or
  - Your **production** project (not ideal for risky experiments) or a separate dev project (same as Option B below).
- In `.env` / `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` = that branch (or dev project) credentials.
  - `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000`.

### 7. Optional: persistent `dev` branch for staging

- In Supabase Dashboard → **Branches**, create a **persistent** branch (e.g. `dev`) from main.
- Use that branch’s URL and keys for:
  - Local `.env` if you want to develop against a stable staging DB, and/or
  - A dedicated staging deployment (e.g. from Git branch `dev`) by setting those env vars in Vercel for **Preview** or a dedicated env (if you don’t rely on auto-injection for that branch).

### 8. Auth redirect URLs

- **Main project:** Authentication → URL Configuration → Site URL and Redirect URLs for `https://b2bmobiles.ca` and `https://b2bmobiles.ca/auth/callback` (or your callback path).
- **Preview branches:** Supabase typically allows the preview URL; if you use a fixed staging URL (e.g. for a persistent `dev` branch), add that staging URL and `/auth/callback` in the **branch’s** Auth settings (or as allowed redirects).
- **Local:** Use `http://localhost:3000` and `http://localhost:3000/auth/callback` in the project/branch you use for local dev.

### 9. Optional: config and seeding

- Add a `config.toml` under `supabase/` if you need branch-specific settings (e.g. different limits, or seed files). See [Supabase Branching Configuration](https://supabase.com/docs/guides/deployment/branching/configuration).
- Use `seed.sql` (or paths referenced in `config.toml`) to give preview branches or a persistent `dev` branch initial data; production data is not copied to branches.

---

## Option B: Two separate Supabase projects

If you prefer not to use Branching, use two independent Supabase projects: one for production, one for development/staging.

**→ Full step-by-step guide:** [OPTION_B_TWO_PROJECTS_SETUP.md](./OPTION_B_TWO_PROJECTS_SETUP.md) — env vars, replicating prod data to dev, clearing production, Vercel per-environment setup, and domains (b2bmobiles.ca = production, stoq-bice.vercel.app = dev/preview).

| Environment     | Supabase project                    | Use for                                 |
| --------------- | ----------------------------------- | --------------------------------------- |
| **Development** | e.g. "Stoq Dev" or "b2bmobiles-dev" | Local, staging deploy from `dev` branch |
| **Production**  | e.g. "Stoq Production"              | Live site (b2bmobiles.ca) only          |

- Create a second project in [Supabase Dashboard](https://supabase.com/dashboard) → **New project** (e.g. "Stoq Dev").
- Run the same migrations in **both** projects (e.g. via SQL Editor or your migrate script with the right env).
- **Local:** In `.env` / `.env.local`, use the **dev** project’s URL, anon key, and service role key; `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000`.
- **Vercel Production:** Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL` for **Production** only, using the **production** project and `https://b2bmobiles.ca`.
- **Vercel Preview:** Set the **same variable names** for **Preview** (and/or Development) with the **dev** project’s credentials and the staging URL. Then:
  - Deploys from `main` → Production env → production Supabase.
  - Deploys from `dev` or feature branches → Preview env → dev Supabase.

Configure Auth redirect URLs in each project (production URLs in the prod project; local and staging in the dev project).

---

## Summary

- **Option A (Supabase Branching):** One project; production = main, PRs = preview branches (and optional persistent `dev`). Migrations and (with Vercel integration) preview env vars are handled by Supabase; fits your Git workflow.
- **Option B (Two projects):** Two Supabase projects; you manage two sets of credentials and run migrations in both; no Branching setup.

Use **Option A** if you want branch-per-PR previews and automatic migration runs; use **Option B** if you prefer fully separate projects and manual control.

---

## Checklist: “I’m about to run a script or migration”

- [ ] Am I targeting a **non-production** environment (preview branch, persistent dev branch, or dev project)?
- [ ] If the script changes or deletes data: have I run it in dev first?
- [ ] For production: am I applying an already-tested migration (e.g. via Deploy to production on merge to main, or manually in the production project) at the right time?
