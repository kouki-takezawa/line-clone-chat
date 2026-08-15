import "server-only";
import { createAdminClient } from "@/lib/supabaseAdmin";

export async function logAdminAction(action: string, targetUserId?: string, detail?: string) {
  const admin = createAdminClient();
  await admin.from("admin_audit_log").insert({
    action,
    target_user_id: targetUserId ?? null,
    detail: detail ?? null,
  });
}
