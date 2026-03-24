/**
 * Seed inventory for a specific company (additive — skips existing rows).
 *
 * Usage:
 *   npm run seed:inventory
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env vars:
 *   SEED_COMPANY_SLUG   — slug of the company to seed inventory for.
 *                         If omitted, the first company in the DB is used.
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), ".env") });
}

import { createClient } from "@supabase/supabase-js";
import { inventoryData } from "../../src/data/inventory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const companySlug = process.env.SEED_COMPANY_SLUG ?? null;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function resolveCompanyId(): Promise<{ id: string; slug: string; name: string }> {
  let query = (supabase.from("companies") as any).select("id, slug, name");

  if (companySlug) {
    query = query.eq("slug", companySlug);
  }

  const { data, error } = await query.limit(1).single();

  if (error || !data) {
    const hint = companySlug
      ? `No company found with slug "${companySlug}".`
      : "No companies found in the database.";
    console.error(`❌ ${hint}`);
    console.error("   Make sure migrations are applied and at least one company exists.");
    console.error("   Set SEED_COMPANY_SLUG=<slug> to target a specific company.");
    process.exit(1);
  }

  return data as { id: string; slug: string; name: string };
}

async function seedInventory(companyId: string): Promise<void> {
  console.log("📦 Loading existing inventory...");

  const { data: existing, error: fetchError } = await (supabase.from("inventory") as any)
    .select("device_name, brand, grade, storage")
    .eq("company_id", companyId);

  if (fetchError) {
    console.error("❌ Failed to fetch existing inventory:", fetchError.message);
    process.exit(1);
  }

  const existingKeys = new Set<string>(
    (existing ?? []).map(
      (row: { device_name: string; brand: string; grade: string; storage: string }) =>
        `${row.device_name}|${row.brand}|${row.grade}|${row.storage}`,
    ),
  );

  const rows = inventoryData
    .filter(
      (item) => !existingKeys.has(`${item.deviceName}|${item.brand}|${item.grade}|${item.storage}`),
    )
    .map((item) => ({
      company_id: companyId,
      device_name: item.deviceName,
      brand: item.brand,
      grade: item.grade,
      storage: item.storage,
      quantity: item.quantity,
      price_per_unit: item.pricePerUnit,
      purchase_price: item.purchasePrice ?? null,
      hst: item.hst ?? null,
      selling_price: item.sellingPrice,
      last_updated: item.lastUpdated,
      price_change: item.priceChange ?? null,
      is_active: true,
    }));

  if (rows.length === 0) {
    console.log(`   ⏭️  All ${inventoryData.length} items already exist — nothing to insert.`);
    return;
  }

  const { error: insertError } = await (supabase.from("inventory") as any).insert(rows);

  if (insertError) {
    console.error("❌ Failed to insert inventory:", insertError.message);
    process.exit(1);
  }

  const skipped = inventoryData.length - rows.length;
  console.log(
    `   ✅ Inserted ${rows.length} new item(s)` +
      (skipped > 0 ? ` (${skipped} already existed, skipped)` : ""),
  );
}

async function main(): Promise<void> {
  console.log("🌱 Seeding inventory...\n");

  const company = await resolveCompanyId();
  console.log(`🏢 Target company: "${company.name}" (slug: ${company.slug})\n`);

  await seedInventory(company.id);

  console.log("\n✅ Inventory seed complete.");
  console.log("   Tip: set SEED_COMPANY_SLUG=<slug> to target a different company.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
