import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";
import { getCurrentAdminUsername } from "@/lib/adminSession";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { count } = await admin.from("admin_users").select("id", { count: "exact", head: true });
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: "最後の管理者アカウントは削除できません" }, { status: 400 });
  }

  const { data: target } = await admin.from("admin_users").select("username").eq("id", id).single<{ username: string }>();
  const currentUsername = await getCurrentAdminUsername();
  if (target?.username === currentUsername) {
    return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
  }

  const { error } = await admin.from("admin_users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction("admin_delete", undefined, target?.username);
  return NextResponse.json({ ok: true });
}
