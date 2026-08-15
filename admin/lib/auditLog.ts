import "server-only";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentAdminUsername } from "@/lib/adminSession";

export async function logAdminAction(action: string, targetUserId?: string, detail?: string) {
  const admin = createAdminClient();
  const adminUsername = await getCurrentAdminUsername();
  await admin.from("admin_audit_log").insert({
    action,
    target_user_id: targetUserId ?? null,
    detail: detail ?? null,
    admin_username: adminUsername,
  });
}
