import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";
import { getCurrentAdminUsername } from "@/lib/adminSession";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1000) : "";
  const scheduledAt = typeof body?.scheduledAt === "string" ? new Date(body.scheduledAt) : null;

  if (!message) {
    return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
  }
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "未来の日時を指定してください" }, { status: 400 });
  }

  const admin = createAdminClient();
  const username = await getCurrentAdminUsername();
  const { error } = await admin
    .from("scheduled_broadcasts")
    .insert({ message, scheduled_at: scheduledAt.toISOString(), created_by: username });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction("broadcast_schedule", undefined, `${scheduledAt.toLocaleString("ja-JP")} — ${message}`);
  return NextResponse.json({ ok: true });
}
