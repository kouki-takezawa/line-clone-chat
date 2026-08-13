import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

// Service-role client — bypasses RLS entirely. Only ever import this from
// Route Handlers / Server Actions, never from a Client Component; the
// "server-only" import above makes any accidental client-bundle import a
// build-time error rather than a leaked secret.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
