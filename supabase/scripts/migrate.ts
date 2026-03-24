/**
 * Supabase Migration Runner
 * - With DATABASE_URL or SUPABASE_DB_URL set: runs pending migrations via direct Postgres connection.
 * - Without DB URL: lists pending migrations and prints manual instructions (Supabase JS client cannot run DDL).
 */

// Load environment variables from .env file
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from project root
config({ path: resolve(process.cwd(), ".env.local") });
// Fallback to .env if .env.local doesn't exist
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.DATABASE_URL &&
  !process.env.SUPABASE_DB_URL
) {
  config({ path: resolve(process.cwd(), ".env") });
}

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { Client } from "pg";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error(
    "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

// Use service role key for migrations (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Get migrations directory path
function getMigrationsDir(): string {
  // Try different possible paths
  const possiblePaths = [
    join(process.cwd(), "supabase", "migrations"),
    join(process.cwd(), "supabase/migrations"),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    "Migrations directory not found. Tried: " + possiblePaths.join(", ")
  );
}

/**
 * Check if schema_migrations table exists
 */
async function checkMigrationsTable(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("schema_migrations")
      .select("version")
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

/** Executed migration key: version_name (supports duplicate version numbers) */
type ExecutedKey = string;

/**
 * Get set of executed migration keys (version_name)
 */
async function getExecutedMigrationSet(): Promise<Set<ExecutedKey>> {
  try {
    const { data, error } = await supabase
      .from("schema_migrations")
      .select("version, name")
      .order("version");

    if (error && error.code !== "42P01") {
      return new Set();
    }

    const keys = (data ?? []).map((m) => `${m.version}_${m.name}`);
    return new Set(keys);
  } catch {
    return new Set();
  }
}

/**
 * Get executed migration set via raw pg (when running migrations with DATABASE_URL)
 */
async function getExecutedMigrationSetFromPg(
  client: Client
): Promise<Set<ExecutedKey>> {
  try {
    const result = await client.query(
      "SELECT version, name FROM public.schema_migrations ORDER BY version, name"
    );
    return new Set(result.rows.map((r) => `${r.version}_${r.name}`));
  } catch {
    // Table may not exist yet (no migrations run)
    return new Set();
  }
}

/**
 * Mark migration as executed
 */
async function recordMigration(version: string, name: string) {
  try {
    await supabase.from("schema_migrations").insert({
      version,
      name,
      executed_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    // If table doesn't exist, we'll create it in the migration
    console.warn(
      "Could not record migration (table may not exist yet):",
      error
    );
  }
}

/**
 * Display migration SQL for manual execution
 */
async function displayMigration(
  filePath: string,
  version: string,
  name: string
) {
  const sql = await readFile(filePath, "utf-8");

  console.log(`\n📄 Migration: ${name} (${version})`);
  console.log("─".repeat(60));
  console.log(sql);
  console.log("─".repeat(60));
}

/**
 * Get migration files from directory (sorted by version then name)
 */
async function getMigrationFiles(): Promise<
  Array<{ version: string; name: string; path: string }>
> {
  const migrationsDir = getMigrationsDir();
  const files = await readdir(migrationsDir);

  return files
    .filter((file) => file.endsWith(".sql"))
    .map((file) => {
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        throw new Error(
          `Invalid migration filename: ${file}. Expected format: 001_name.sql`
        );
      }
      return {
        version: match[1],
        name: match[2],
        path: join(migrationsDir, file),
      };
    })
    .sort(
      (a, b) =>
        a.version.localeCompare(b.version) || a.name.localeCompare(b.name)
    );
}

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
}

/**
 * Record a migration in schema_migrations. Handles both PK shapes:
 * - Before migration 004: PK is (version) only → use ON CONFLICT (version)
 * - After migration 004: PK is (version, name) → use ON CONFLICT (version, name)
 */
async function recordMigrationWithPg(
  client: Client,
  version: string,
  name: string
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO public.schema_migrations (version, name, executed_at) VALUES ($1, $2, NOW())
       ON CONFLICT (version, name) DO NOTHING`,
      [version, name]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "42P10") {
      await client.query(
        `INSERT INTO public.schema_migrations (version, name, executed_at) VALUES ($1, $2, NOW())
         ON CONFLICT (version) DO UPDATE SET name = $2, executed_at = NOW()`,
        [version, name]
      );
    } else {
      throw err;
    }
  }
}

/**
 * Execute pending migrations via direct Postgres connection
 */
async function executeMigrationsWithPg(dbUrl: string) {
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
  } catch (err) {
    console.error(
      "❌ Could not connect to database. Check DATABASE_URL or SUPABASE_DB_URL."
    );
    console.error(err);
    process.exit(1);
  }

  try {
    const migrationFiles = await getMigrationFiles();
    const executedSet = await getExecutedMigrationSetFromPg(client);
    const pending = migrationFiles.filter(
      (m) => !executedSet.has(`${m.version}_${m.name}`)
    );

    if (pending.length === 0) {
      console.log("✅ All migrations have been executed.\n");
      return;
    }

    console.log(`📋 Running ${pending.length} pending migration(s)...\n`);

    for (const migration of pending) {
      const sql = await readFile(migration.path, "utf-8");
      console.log(`   Running ${migration.version}: ${migration.name}...`);

      try {
        await client.query(sql);
        await recordMigrationWithPg(client, migration.version, migration.name);
        console.log(`   ✅ ${migration.version}: ${migration.name}`);
      } catch (err) {
        console.error(
          `   ❌ Failed ${migration.version}: ${migration.name}`,
          err
        );
        await client.end();
        process.exit(1);
      }
    }

    console.log("\n✅ Migrations complete.\n");
  } finally {
    await client.end();
  }
}

/**
 * Main migration function
 * If DATABASE_URL/SUPABASE_DB_URL is set: runs migrations. Otherwise lists pending and shows manual instructions.
 */
async function runMigrations() {
  const dbUrl = getDatabaseUrl();

  if (dbUrl) {
    console.log("🚀 Supabase Migration Runner (direct DB)\n");
    await executeMigrationsWithPg(dbUrl);
    return;
  }

  console.log("🚀 Supabase Migration Checker\n");
  console.log("Note: Supabase JS client cannot execute DDL statements.");
  console.log(
    "Set DATABASE_URL or SUPABASE_DB_URL to run migrations from CLI, or run manually via Dashboard.\n"
  );

  try {
    const tableExists = await checkMigrationsTable();
    if (!tableExists) {
      console.log("⚠️  schema_migrations table does not exist yet.");
      console.log("   It will be created by the first migration.\n");
    }

    const migrationFiles = await getMigrationFiles();
    console.log(`Found ${migrationFiles.length} migration file(s)\n`);

    if (migrationFiles.length === 0) {
      console.log("No migrations found.");
      return;
    }

    const executedSet = tableExists
      ? await getExecutedMigrationSet()
      : new Set<ExecutedKey>();
    const pending = migrationFiles.filter(
      (m) => !executedSet.has(`${m.version}_${m.name}`)
    );

    if (pending.length === 0) {
      console.log("✅ All migrations have been executed.\n");
      return;
    }

    console.log(`📋 Pending migrations (${pending.length}):\n`);

    for (const migration of pending) {
      console.log(`   ${migration.version}: ${migration.name}`);
    }

    console.log("\n📝 To execute migrations:");
    console.log("   Option A — Set DB URL and run again:");
    console.log(
      '     Add to .env.local: DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"'
    );
    console.log(
      "     (Get from Supabase Dashboard → Settings → Database → Connection string → URI)"
    );
    console.log("     Then: npm run migrate");
    console.log(
      "   Option B — Manual: Supabase Dashboard → SQL Editor, run each migration file in order."
    );
    console.log(
      "   Option C — Supabase CLI: supabase link --project-ref <ref> && supabase db push\n"
    );

    const args = process.argv.slice(2);
    if (args.includes("--show") || args.includes("-s")) {
      console.log("\n📄 Migration SQL files:\n");
      for (const migration of pending) {
        await displayMigration(
          migration.path,
          migration.version,
          migration.name
        );
      }
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

/**
 * Record a migration as executed (after manual execution)
 */
async function recordMigrationManually(version: string, name: string) {
  const tableExists = await checkMigrationsTable();

  if (!tableExists) {
    console.error("❌ schema_migrations table does not exist.");
    console.error("   Please run the first migration first.");
    process.exit(1);
  }

  try {
    await recordMigration(version, name);
    console.log(`✅ Recorded migration ${version}: ${name}`);
  } catch (error) {
    console.error("❌ Failed to record migration:", error);
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule =
  require.main === module ||
  (typeof process !== "undefined" && process.argv[1]?.endsWith("migrate.ts"));

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args[0] === "record" && args[1] && args[2]) {
    recordMigrationManually(args[1], args[2]).catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
  } else {
    runMigrations().catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
  }
}

export { runMigrations, recordMigrationManually };
