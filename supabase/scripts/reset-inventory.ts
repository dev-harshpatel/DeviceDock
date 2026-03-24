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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED_BRANDS = ["Google", "Samsung", "Apple", "Motorola"];

async function resetInventory(): Promise<void> {
  console.log("🔄 Resetting orders and inventory (clear + fresh seed)...\n");

  const { error: ordersDeleteError } = await supabase
    .from("orders")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (ordersDeleteError) {
    console.error("❌ Failed to clear orders:", ordersDeleteError.message);
    process.exit(1);
  }
  console.log("   ✅ Orders table cleared");

  const filtered = inventoryData.filter((item) =>
    ALLOWED_BRANDS.includes(item.brand),
  );
  if (filtered.length === 0) {
    console.error(
      "❌ No inventory data for brands:",
      ALLOWED_BRANDS.join(", "),
    );
    process.exit(1);
  }

  const rows = filtered.map((item) => ({
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
  }));

  const { error: deleteError } = await supabase
    .from("inventory")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error("❌ Failed to clear inventory:", deleteError.message);
    process.exit(1);
  }

  const { error: insertError } = await supabase.from("inventory").insert(rows);

  if (insertError) {
    console.error("❌ Failed to insert inventory:", insertError.message);
    process.exit(1);
  }

  console.log(
    `✅ Inventory reset: ${rows.length} devices (${ALLOWED_BRANDS.join(", ")})`,
  );
  console.log(
    "   price_per_unit = cost (purchase_price/quantity)*(1+hst/100), selling_price = customer price, hst = 13%",
  );
  console.log("\n   Orders and inventory are now fresh.");
}

resetInventory().catch((err) => {
  console.error(err);
  process.exit(1);
});
