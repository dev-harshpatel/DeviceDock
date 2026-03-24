## Supabase: Sync Dev Schema & RLS From Prod

This guide explains how to **copy all schema + RLS policies** from your Supabase **prod** database (`stoq`) to your **dev** database (`stoq-dev`) using `pg_dump` and `psql` on Windows.

You will:

- Back up the current **dev** schema (safety).
- Dump the **prod** schema (includes RLS policies).
- Apply that schema onto **dev**, so `stoq-dev` matches `stoq`.

> **Important:** This process affects **only schema and RLS** (tables, views, functions, policies, etc.), not data.  
> Do **not** commit real connection strings or passwords to git.

---

## 1. Prerequisites & Files

- You are on **Windows**.
- You have access to both Supabase projects:
  - Prod: `stoq`
  - Dev: `stoq-dev`
- In the repo root you have an `info.txt` (or similar) with **commented** connection strings:

```text
# PROD_CONNECTION_STRING=postgresql://postgres:...@db.PROD_ID.supabase.co:5432/postgres
# DEV_CONNECTION_STRING=postgresql://postgres:...@db.DEV_ID.supabase.co:5432/postgres
```

These are **direct Postgres URIs** (hosts like `db.xxx.supabase.co`), **not** pooler URLs (`*.pooler.supabase.com`).

> **Security:** Keep this file out of git or strip the passwords before committing.

---

## 2. Install PostgreSQL Client Tools (psql / pg_dump)

You need `psql` and `pg_dump` locally.

1. Go to the official Postgres download page for Windows:  
   `https://www.postgresql.org/download/windows/`
2. Download the latest 64‑bit installer (e.g. **PostgreSQL 16**).
3. Run the installer:
   - When asked for components, keep **Command Line Tools** selected (defaults are fine).
   - Note the install directory, typically:
     - `C:\Program Files\PostgreSQL\16\bin`
4. After install, open **PowerShell** and verify:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" --version
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" --version
```

If both commands print a version, the tools are ready.

> If your install path or version is different, adjust `16` to match (e.g. `15`).

---

## 3. Create a Local Backup Folder

In PowerShell (any directory is fine):

```powershell
mkdir "D:\supabase-backups" -ErrorAction SilentlyContinue
```

This will store:

- A **backup** of the current `stoq-dev` schema.
- The **prod** schema dump.

---

## 4. Backup Current Dev Schema (Safety)

This step backs up the current (possibly broken) **dev** schema so you can restore it if needed.

1. Open **PowerShell** (or the integrated terminal in Cursor).
2. Copy your **dev** connection string from `info.txt`, remove the leading `# ` and the `DEV_CONNECTION_STRING=` part, so it looks like:

```text
postgresql://postgres:...@db.qhzmlezvvyhhxtiytsob.supabase.co:5432/postgres
```

3. Run:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
  --schema-only --no-owner --no-privileges `
  "PASTE_DEV_CONNECTION_STRING_HERE" `
  > "D:\supabase-backups\stoq_dev_schema_before_fix.sql"
```

Replace `PASTE_DEV_CONNECTION_STRING_HERE` with your actual **dev** URI from `info.txt`.

If the command finishes without an error, you now have:

- `D:\supabase-backups\stoq_dev_schema_before_fix.sql` — backup of the old dev schema.

---

## 5. Dump Prod Schema (Includes RLS)

Now dump the schema from **prod** (`stoq`). This includes:

- Tables, views, materialized views.
- Types, functions, triggers.
- **All RLS policies** on those tables.

1. From `info.txt`, copy the **prod** connection string, removing the `# ` and `PROD_CONNECTION_STRING=` prefix, so it looks like:

```text
postgresql://postgres:...@db.ezfcguwigdfbhycufgtd.supabase.co:5432/postgres
```

2. Run:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
  --schema-only --no-owner --no-privileges `
  "PASTE_PROD_CONNECTION_STRING_HERE" `
  > "D:\supabase-backups\stoq_prod_schema.sql"
```

Again, replace `PASTE_PROD_CONNECTION_STRING_HERE` with your actual **prod** URI.

On success, you get:

- `D:\supabase-backups\stoq_prod_schema.sql` — prod schema + RLS.

---

## 6. Apply Prod Schema to Dev

This step **makes `stoq-dev` match `stoq` schema + RLS**.

> **Warning:** This can override existing schema objects in dev (tables, views, functions, policies, etc.). It does **not** change data, but if dev has incompatible custom schema, you may get errors.

1. Run:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" `
  "PASTE_DEV_CONNECTION_STRING_HERE" `
  -f "D:\supabase-backups\stoq_prod_schema.sql"
```

Use the **same dev** connection string you used in step 4.

2. Watch the output:
   - You should see many `CREATE TABLE`, `CREATE FUNCTION`, `CREATE POLICY`, etc.
   - If it completes successfully, the dev schema and RLS policies now match prod.

### 6.1 Handling Common Errors

- **“relation ... already exists”**  
  Dev already has objects that conflict with the prod schema. Options:
  - Drop the conflicting tables/views/functions in dev (via Supabase SQL editor or `psql`), then re-run the command, **or**
  - Reset the entire dev database (if you are okay losing dev schema) and rerun the `psql` command.

- **Permission errors** (`permission denied`)  
  Ensure you are using the `postgres` superuser connection string from Supabase, not a restricted role.

If you get a specific error, copy just the error text (no connection strings) and debug from there.

---

## 7. App Configuration After Sync

For this “Option 2” flow (syncing schema into existing dev DB):

- Your `.env` for development **does not need to change**:
  - It should already be pointing to `stoq-dev`.
- After the schema sync:
  - Restart your dev server (`npm run dev` / `pnpm dev` / `yarn dev`) so it picks up any env changes you might have made earlier (if any).
  - Test key flows to confirm that RLS‑related issues are resolved.

---

## 8. Optional: Restore Old Dev Schema Backup

If you need to restore the **old** dev schema backup:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" `
  "PASTE_DEV_CONNECTION_STRING_HERE" `
  -f "D:\supabase-backups\stoq_dev_schema_before_fix.sql"
```

This attempts to recreate what dev looked like before you applied the prod schema.

> Note: If the DB has changed significantly after the sync, restoring may also produce conflicts. This should be treated as a last‑resort recovery tool.

---

## 9. Security Cleanup

Because you are pasting full Postgres URIs (with passwords) into local files and commands:

- **Rotate database passwords** in Supabase when you are done:
  - In the Supabase dashboard for each project:
    - Go to `Database` → credentials / reset password.
- Update:
  - Your `.env` (e.g. `DATABASE_URL` or any other DB vars).
  - `info.txt` (or delete it entirely).
- Never commit real credentials to version control.

---

## 10. Quick Summary (Checklist)

1. Install PostgreSQL client tools (`pg_dump`, `psql`) on Windows.
2. Create `D:\supabase-backups` (or another backup folder).
3. Backup dev schema:
   - `pg_dump --schema-only ... DEV_CONNECTION_STRING > stoq_dev_schema_before_fix.sql`
4. Dump prod schema:
   - `pg_dump --schema-only ... PROD_CONNECTION_STRING > stoq_prod_schema.sql`
5. Apply prod schema to dev:
   - `psql DEV_CONNECTION_STRING -f stoq_prod_schema.sql`
6. Test your app against `stoq-dev`.
7. Rotate DB passwords and update `.env` / local notes.

Follow these steps whenever you need to **re-sync dev schema + RLS from prod** without touching data.

