import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

const DURATIONS = new Set(["24h", "168h", "720h", "876000h", "none"]);
const DURATION_LABELS: Record<string, string> = { "24h": "1日", "168h": "7日", "720h": "30日", "876000h": "無期限" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown): v is string => typeof v === "string") : [];
  const duration = typeof body?.duration === "string" && DURATIONS.has(body.duration) ? body.duration : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (ids.length === 0 || !duration) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  let succeeded = 0;
  for (const id of ids) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: duration,
      app_metadata: { ban_reason: duration === "none" ? null : reason || null },
    });
    if (!error) {
      succeeded += 1;
      await logAdminAction(
        duration === "none" ? "unrestrict" : "restrict",
        id,
        duration === "none" ? undefined : `${DURATION_LABELS[duration]}${reason ? ` — ${reason}` : ""}`,
      );
    }
  }

  return NextResponse.json({ succeeded, total: ids.length });
}
