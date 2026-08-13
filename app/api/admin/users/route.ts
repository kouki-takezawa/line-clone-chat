import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidLoginId, isValidPassword, loginIdToEmail } from "@/lib/loginId";

const MAX_FRIENDS = 5;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, display_name, login_id, avatar_emoji, is_admin, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json();
  const loginId = String(body.loginId ?? "");
  const password = String(body.password ?? "");
  const displayName = String(body.displayName ?? "").trim();

  if (!isValidLoginId(loginId)) {
    return NextResponse.json({ error: "ログインIDは半角英数字4〜32文字で入力してください" }, { status: 400 });
  }
  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "パスワードは6文字以上で入力してください" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "表示名を入力してください" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { count: friendCount, error: countError } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_admin", false);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if ((friendCount ?? 0) >= MAX_FRIENDS) {
    return NextResponse.json(
      { error: `友達は最大${MAX_FRIENDS}人までです` },
      { status: 400 },
    );
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: loginIdToEmail(loginId),
    password,
    email_confirm: true,
    user_metadata: { login_id: loginId, display_name: displayName, is_admin: false },
  });

  if (createError || !created.user) {
    const message = createError?.message.includes("already been registered")
      ? "そのログインIDは既に使われています"
      : (createError?.message ?? "作成に失敗しました");
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const newUserId = created.user.id;

  const { data: room, error: roomError } = await adminClient
    .from("rooms")
    .insert({ name: displayName })
    .select("id")
    .single();

  if (roomError || !room) {
    await adminClient.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: roomError?.message ?? "ルーム作成に失敗しました" }, { status: 500 });
  }

  const { error: memberError } = await adminClient.from("room_members").insert([
    { room_id: room.id, user_id: admin.id },
    { room_id: room.id, user_id: newUserId },
  ]);

  if (memberError) {
    await adminClient.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ userId: newUserId, roomId: room.id });
}
