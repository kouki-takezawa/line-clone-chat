import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin.from("scheduled_broadcasts").delete().eq("id", id).is("sent_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction("broadcast_cancel", undefined, id);
  return NextResponse.json({ ok: true });
}
