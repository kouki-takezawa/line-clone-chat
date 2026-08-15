import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { createSessionToken, SESSION_COOKIE } from "@/lib/adminAuth";
import { verifyPassword } from "@/lib/passwordHash";

type AdminUserRow = { id: string; username: string; password_hash: string };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "ユーザー名とパスワードを入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: adminUser } = await admin
    .from("admin_users")
    .select("id, username, password_hash")
    .eq("username", username)
    .single<AdminUserRow>();

  if (!adminUser || !verifyPassword(password, adminUser.password_hash)) {
    return NextResponse.json({ error: "ユーザー名またはパスワードが違います" }, { status: 401 });
  }

  await admin.from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", adminUser.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(adminUser.username), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
