import "server-only";
import { createClient } from "@/lib/supabase/server";

// Confirms the current session belongs to an is_admin profile. Used by
// every admin-only Route Handler before touching the service-role client.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return null;
  return user;
}
