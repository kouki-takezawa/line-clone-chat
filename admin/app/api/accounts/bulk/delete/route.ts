import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown): v is string => typeof v === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  let succeeded = 0;
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) {
      succeeded += 1;
      await logAdminAction("delete", id);
    }
  }

  return NextResponse.json({ succeeded, total: ids.length });
}
