/**
 * Super Admin Seed Script
 * Creates (or promotes) a platform super admin user.
 *
 * Usage: npm run seed:super-admin
 *
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPER_ADMIN_EMAIL    (optional, defaults to work.patelharsh@gmail.com)
 * - SUPER_ADMIN_PASSWORD (optional, defaults to whothehellitis)
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  config({ path: resolve(process.cwd(), '.env') });
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'work.patelharsh@gmail.com';
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'whothehellitis';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedSuperAdmin() {
  console.log('🌱 Seeding platform super admin...\n');

  // 1. Resolve or create the auth user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = users.find((u) => u.email === superAdminEmail);
  let userId: string;

  if (existing) {
    console.log(`   Auth user already exists: ${superAdminEmail}`);
    userId = existing.id;
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: superAdminEmail,
      password: superAdminPassword,
      email_confirm: true,
    });
    if (createError) throw createError;
    if (!created.user) throw new Error('Failed to create auth user');
    userId = created.user.id;
    console.log(`   ✅ Created auth user: ${superAdminEmail}`);
  }

  // 2. Ensure a user_profiles row exists (role = 'admin' for legacy compat)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('user_id, role')
    .eq('user_id', userId)
    .single();

  if (profile) {
    if (profile.role !== 'admin') {
      await supabase
        .from('user_profiles')
        .update({ role: 'admin' })
        .eq('user_id', userId);
      console.log('   ✅ Updated user_profiles role → admin');
    } else {
      console.log('   user_profiles row already has role=admin');
    }
  } else {
    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert({ user_id: userId, role: 'admin' });
    if (insertError) throw insertError;
    console.log('   ✅ Created user_profiles row (role=admin)');
  }

  // 3. Insert into platform_super_admins (idempotent via upsert)
  const { error: superAdminError } = await supabase
    .from('platform_super_admins')
    .upsert({ user_id: userId }, { onConflict: 'user_id' });

  if (superAdminError) throw superAdminError;
  console.log('   ✅ Registered in platform_super_admins');

  console.log('\n✅ Super admin seeded successfully!');
  console.log(`   Email:    ${superAdminEmail}`);
  console.log(`   Password: ${superAdminPassword}`);
}

seedSuperAdmin().catch((err) => {
  console.error('\n❌ Failed:', err);
  process.exit(1);
});
