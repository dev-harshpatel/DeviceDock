/**
 * Database Seed Script
 * Creates admin user, sample users, inventory items, and orders
 *
 * Usage: npm run seed
 *
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SEED_ADMIN_EMAIL (optional, defaults to admin@invn.com)
 * - SEED_ADMIN_PASSWORD (optional, defaults to admin123)
 */

// Load environment variables from .env file
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from project root
config({ path: resolve(process.cwd(), ".env.local") });
// Fallback to .env if .env.local doesn't exist
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), ".env") });
}

import { createClient } from "@supabase/supabase-js";
import { Database } from "../../src/lib/database.types";
import { inventoryData } from "../../src/data/inventory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@invn.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
const seedCompanySlug = process.env.SEED_COMPANY_SLUG ?? null;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Resolve company UUID from SEED_COMPANY_SLUG or first company in DB
 */
async function resolveCompanyId(): Promise<string | null> {
  let query = (supabase.from("companies") as any).select("id, slug, name");
  if (seedCompanySlug) {
    query = query.eq("slug", seedCompanySlug);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data) {
    console.warn("   ⚠️  No company found — inventory will be skipped.");
    console.warn("   Set SEED_COMPANY_SLUG=<slug> to target a company.");
    return null;
  }
  console.log(`   🏢 Using company: "${data.name}" (slug: ${data.slug})`);
  return data.id as string;
}

/**
 * Generate UUID v4
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create admin user and profile
 */
async function createAdminUser() {
  console.log("👤 Creating admin user...");

  try {
    // Check if admin user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAdmin = existingUsers?.users.find((u: any) => u.email === adminEmail);

    let adminUserId: string;

    if (existingAdmin) {
      console.log(`   Admin user already exists: ${adminEmail}`);
      adminUserId = existingAdmin.id;
    } else {
      // Create admin user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });

      if (createError) {
        throw createError;
      }

      if (!newUser.user) {
        throw new Error("Failed to create admin user");
      }

      adminUserId = newUser.user.id;
      console.log(`   ✅ Created admin user: ${adminEmail}`);
    }

    // Create or update admin profile
    const { data: existingProfile } = await (supabase.from("user_profiles") as any)
      .select("*")
      .eq("user_id", adminUserId)
      .single();

    if (existingProfile) {
      // Update to admin role if not already
      if (existingProfile.role !== "admin") {
        await (supabase.from("user_profiles") as any)
          .update({ role: "admin" })
          .eq("user_id", adminUserId);
        console.log("   ✅ Updated admin profile role");
      } else {
        console.log("   ✅ Admin profile already exists");
      }
    } else {
      // Create admin profile
      const { error: profileError } = await supabase.from("user_profiles").insert({
        user_id: adminUserId,
        role: "admin",
      });

      if (profileError) {
        throw profileError;
      }

      console.log("   ✅ Created admin profile");
    }

    return adminUserId;
  } catch (error) {
    console.error("   ❌ Failed to create admin user:", error);
    throw error;
  }
}

/**
 * Create sample regular users
 */
async function createSampleUsers(): Promise<string[]> {
  console.log("👥 Creating sample users...");

  const sampleUsers = [
    { email: "user1@example.com", password: "user123" },
    { email: "user2@example.com", password: "user123" },
  ];

  const userIds: string[] = [];

  for (const userData of sampleUsers) {
    try {
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find((u: any) => u.email === userData.email);

      let userId: string;

      if (existingUser) {
        console.log(`   User already exists: ${userData.email}`);
        userId = existingUser.id;
      } else {
        // Create user
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
        });

        if (createError) {
          console.error(`   ⚠️  Failed to create user ${userData.email}:`, createError.message);
          continue;
        }

        if (!newUser.user) {
          console.error(`   ⚠️  Failed to create user ${userData.email}`);
          continue;
        }

        userId = newUser.user.id;
        console.log(`   ✅ Created user: ${userData.email}`);
      }

      // Create or check profile
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!existingProfile) {
        await supabase.from("user_profiles").insert({
          user_id: userId,
          role: "user",
        });
        console.log(`   ✅ Created profile for: ${userData.email}`);
      }

      userIds.push(userId);
    } catch (error) {
      console.error(`   ⚠️  Error with user ${userData.email}:`, error);
    }
  }

  return userIds;
}

/**
 * Seed inventory items (company-scoped)
 */
async function seedInventory(companyId: string | null) {
  console.log("📦 Seeding inventory...");

  if (!companyId) {
    console.log("   ⏭️  No company resolved — skipping inventory.");
    return;
  }

  try {
    // Get existing items for this company to skip duplicates
    const { data: existingItems } = await (supabase.from("inventory") as any)
      .select("device_name, brand, grade, storage")
      .eq("company_id", companyId);

    const existingKeys = new Set(
      (existingItems ?? []).map(
        (item: any) => `${item.device_name}|${item.brand}|${item.grade}|${item.storage}`,
      ),
    );

    const inventoryItems = inventoryData
      .filter(
        (item) =>
          !existingKeys.has(`${item.deviceName}|${item.brand}|${item.grade}|${item.storage}`),
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
        price_change: item.priceChange || null,
        is_active: true,
      }));

    if (inventoryItems.length === 0) {
      console.log(`   ⏭️  All inventory items already exist, skipping...`);
      return;
    }

    const { error } = await (supabase.from("inventory") as any).insert(inventoryItems);
    if (error) throw error;

    const skipped = inventoryData.length - inventoryItems.length;
    console.log(
      `   ✅ Seeded ${inventoryItems.length} inventory items` +
        (skipped > 0 ? ` (${skipped} skipped)` : ""),
    );
  } catch (error) {
    console.error("   ❌ Failed to seed inventory:", error);
    throw error;
  }
}

/**
 * Create sample orders (company-scoped)
 */
async function createSampleOrders(userIds: string[], companyId: string | null) {
  console.log("🛒 Creating sample orders...");

  if (userIds.length === 0) {
    console.log("   ⏭️  No users available, skipping orders...");
    return;
  }

  if (!companyId) {
    console.log("   ⏭️  No company resolved, skipping orders...");
    return;
  }

  try {
    // Get inventory items for this company
    const { data: inventoryItems, error: invError } = await (supabase.from("inventory") as any)
      .select("*")
      .eq("company_id", companyId)
      .limit(5);

    if (invError || !inventoryItems || inventoryItems.length === 0) {
      console.log("   ⏭️  No inventory items available, skipping orders...");
      return;
    }

    // Check if orders already exist for this company
    const { data: existingOrders } = await (supabase.from("orders") as any)
      .select("id")
      .eq("company_id", companyId)
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      console.log("   ⏭️  Orders already exist, skipping...");
      return;
    }

    // Create sample orders
    const sampleOrders = [];

    for (let i = 0; i < Math.min(3, userIds.length); i++) {
      const userId = userIds[i];
      const item1 = inventoryItems[i % inventoryItems.length];
      const item2 = inventoryItems[(i + 1) % inventoryItems.length];

      const orderItems = [
        {
          item: {
            id: item1.id,
            deviceName: item1.device_name,
            brand: item1.brand,
            grade: item1.grade,
            storage: item1.storage,
            quantity: item1.quantity,
            pricePerUnit: Number(item1.price_per_unit),
            sellingPrice: Number(item1.selling_price ?? item1.price_per_unit),
            lastUpdated: item1.last_updated,
            priceChange: item1.price_change || undefined,
          },
          quantity: 1,
        },
        {
          item: {
            id: item2.id,
            deviceName: item2.device_name,
            brand: item2.brand,
            grade: item2.grade,
            storage: item2.storage,
            quantity: item2.quantity,
            pricePerUnit: Number(item2.price_per_unit),
            sellingPrice: Number(item2.selling_price ?? item2.price_per_unit),
            lastUpdated: item2.last_updated,
            priceChange: item2.price_change || undefined,
          },
          quantity: 2,
        },
      ];

      const totalPrice = orderItems.reduce(
        (sum, oi) => sum + oi.item.sellingPrice * oi.quantity,
        0,
      );

      sampleOrders.push({
        id: generateUUID(),
        company_id: companyId,
        user_id: userId,
        items: orderItems,
        total_price: totalPrice,
        status: i === 0 ? "pending" : i === 1 ? "approved" : "completed",
      });
    }

    const { error } = await (supabase.from("orders") as any).insert(sampleOrders);

    if (error) {
      throw error;
    }

    console.log(`   ✅ Created ${sampleOrders.length} sample orders`);
  } catch (error) {
    console.error("   ❌ Failed to create sample orders:", error);
    throw error;
  }
}

/**
 * Main seed function
 */
async function seed() {
  console.log("🌱 Starting database seed...\n");

  try {
    // Create admin user
    const adminUserId = await createAdminUser();
    console.log("");

    // Create sample users
    const userIds = await createSampleUsers();
    console.log("");

    // Resolve company for inventory seeding
    const companyId = await resolveCompanyId();
    console.log("");

    // Seed inventory
    await seedInventory(companyId);
    console.log("");

    // Create sample orders
    await createSampleOrders([adminUserId, ...userIds], companyId);
    console.log("");

    console.log("✅ Seed completed successfully!");
    console.log("\n📝 Login credentials:");
    console.log(`   Admin: ${adminEmail} / ${adminPassword}`);
    console.log(`   User 1: user1@example.com / user123`);
    console.log(`   User 2: user2@example.com / user123`);
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    process.exit(1);
  }
}

// Run seed if executed directly
if (require.main === module || process.argv[1]?.endsWith("seed.ts")) {
  seed().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { seed };
