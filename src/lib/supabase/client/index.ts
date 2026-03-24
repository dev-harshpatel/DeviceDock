/**
 * Supabase client exports
 * Browser, server, and admin clients for different contexts
 *
 * NOTE: For client components, import directly from './browser'
 * For server components, import from './server' or './admin'
 */

// Only export browser client by default to avoid importing server code in client components
export * from "./browser";

// Server and admin clients should be imported directly:
// import { createClient } from '@/lib/supabase/client/server'
// import { supabaseAdmin } from '@/lib/supabase/client/admin'
