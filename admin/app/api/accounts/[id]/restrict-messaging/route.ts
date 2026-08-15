import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const restrict = Boolean(body?.restrict);

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ messaging_restricted: restrict }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(restrict ? "restrict_messaging" : "unrestrict_messaging", id);
  return NextResponse.json({ ok: true });
}
