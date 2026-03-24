/**
 * Reset inventory and orders: clear both tables, then insert fresh devices (Google, Samsung, Apple, Motorola).
 * Uses proper cost and tax: price_per_unit = (purchase_price/quantity)*(1 + hst/100), selling_price = customer price.
 *
 * Usage: npm run reset-inventory
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), ".env") });
}

import { createClient } from "@supabase/supabase-js";
import { Database } from "../../src/lib/database.types";
import { inventoryData } from "../../src/data/inventory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seedCompanySlug = process.env.SEED_COMPANY_SLUG ?? null;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED_BRANDS = ["Google", "Samsung", "Apple", "Motorola"];

async function resolveCompanyId(): Promise<string> {
  let query = (supabase.from("companies") as any).select("id, slug, name");
  if (seedCompanySlug) {
    query = query.eq("slug", seedCompanySlug);
  }
  const { data, error } = await query.limit(1).single();
  if (error || !data) {
    console.error(
      seedCompanySlug
        ? `❌ No company found with slug "${seedCompanySlug}".`
        : "❌ No companies found in the database.",
    );
    console.error("   Set SEED_COMPANY_SLUG=<slug> in .env to target a specific company.");
    process.exit(1);
  }
  console.log(`   🏢 Target company: "${data.name}" (slug: ${data.slug})`);
  return data.id as string;
}

async function resetInventory(): Promise<void> {
  console.log("🔄 Resetting orders and inventory (clear + fresh seed)...\n");

  const companyId = await resolveCompanyId();

  // Delete orders for this company only
  const { error: ordersDeleteError } = await (supabase.from("orders") as any)
    .delete()
    .eq("company_id", companyId);

  if (ordersDeleteError) {
    console.error("❌ Failed to clear orders:", ordersDeleteError.message);
    process.exit(1);
  }
  console.log("   ✅ Orders cleared for this company");

  const filtered = inventoryData.filter((item) => ALLOWED_BRANDS.includes(item.brand));
  if (filtered.length === 0) {
    console.error("❌ No inventory data for brands:", ALLOWED_BRANDS.join(", "));
    process.exit(1);
  }

  // Delete inventory for this company only
  const { error: deleteError } = await (supabase.from("inventory") as any)
    .delete()
    .eq("company_id", companyId);

  if (deleteError) {
    console.error("❌ Failed to clear inventory:", deleteError.message);
    process.exit(1);
  }
  console.log("   ✅ Inventory cleared for this company");

  const rows = filtered.map((item) => ({
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

  const { error: insertError } = await (supabase.from("inventory") as any).insert(rows);

  if (insertError) {
    console.error("❌ Failed to insert inventory:", insertError.message);
    process.exit(1);
  }

  console.log(`\n✅ Inventory reset: ${rows.length} devices (${ALLOWED_BRANDS.join(", ")})`);
  console.log(
    "   price_per_unit = cost (purchase_price/quantity)*(1+hst/100), selling_price = customer price, hst = 13%",
  );
  console.log("   Orders and inventory are now fresh for this company.");
}

resetInventory().catch((err) => {
  console.error(err);
  process.exit(1);
});
