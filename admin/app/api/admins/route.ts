import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { hashPassword } from "@/lib/passwordHash";
import { logAdminAction } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || password.length < 8) {
    return NextResponse.json({ error: "ユーザー名とパスワード(8文字以上)を入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("admin_users").insert({ username, password_hash: hashPassword(password) });
  if (error) {
    const friendly = error.message.includes("duplicate") ? "そのユーザー名は既に使われています" : error.message;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  await logAdminAction("admin_create", undefined, username);
  return NextResponse.json({ ok: true });
}
