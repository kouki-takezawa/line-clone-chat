import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

// Account restriction reuses Supabase Auth's built-in ban_duration instead
// of a custom schema column. "876000h" (~100 years) is Supabase's own
// documented way to express a de-facto permanent ban; "none" lifts it.
const DURATIONS = new Set(["24h", "168h", "720h", "876000h", "none"]);
const DURATION_LABELS: Record<string, string> = {
  "24h": "1日",
  "168h": "7日",
  "720h": "30日",
  "876000h": "無期限",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const duration = typeof body?.duration === "string" && DURATIONS.has(body.duration) ? body.duration : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (!duration) {
    return NextResponse.json({ error: "invalid duration" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: duration,
    app_metadata: { ban_reason: duration === "none" ? null : reason || null },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(
    duration === "none" ? "unrestrict" : "restrict",
    id,
    duration === "none" ? undefined : `${DURATION_LABELS[duration]}${reason ? ` — ${reason}` : ""}`,
  );

  return NextResponse.json({ ok: true });
}
