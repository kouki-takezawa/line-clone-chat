import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidLoginId, isValidPassword, loginIdToEmail } from "@/lib/loginId";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id: targetId } = await params;
  const body = await request.json();
  const loginId = body.loginId !== undefined ? String(body.loginId) : undefined;
  const password = body.password !== undefined ? String(body.password) : undefined;
  const displayName = body.displayName !== undefined ? String(body.displayName).trim() : undefined;

  if (loginId !== undefined && !isValidLoginId(loginId)) {
    return NextResponse.json({ error: "ログインIDは半角英数字4〜32文字で入力してください" }, { status: 400 });
  }
  if (password !== undefined && !isValidPassword(password)) {
    return NextResponse.json({ error: "パスワードは6文字以上で入力してください" }, { status: 400 });
  }
  if (displayName !== undefined && !displayName) {
    return NextResponse.json({ error: "表示名を入力してください" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const authUpdate: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {};
  if (loginId !== undefined) {
    authUpdate.email = loginIdToEmail(loginId);
    authUpdate.user_metadata = { login_id: loginId };
  }
  if (password !== undefined) authUpdate.password = password;

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, authUpdate);
    if (authError) {
      const message = authError.message.includes("already been registered")
        ? "そのログインIDは既に使われています"
        : authError.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const profileUpdate: { login_id?: string; display_name?: string } = {};
  if (loginId !== undefined) profileUpdate.login_id = loginId;
  if (displayName !== undefined) profileUpdate.display_name = displayName;

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", targetId);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id: targetId } = await params;
  if (targetId === admin.id) {
    return NextResponse.json({ error: "自分自身のアカウントは削除できません" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Clean up the 1:1 room shared with this friend before removing the auth
  // user (deleting the user cascades to profiles/room_members/messages, but
  // the now-empty room row itself would otherwise be left behind).
  const { data: sharedRooms } = await adminClient
    .from("room_members")
    .select("room_id")
    .eq("user_id", targetId);

  if (sharedRooms && sharedRooms.length > 0) {
    const { data: adminRooms } = await adminClient
      .from("room_members")
      .select("room_id")
      .eq("user_id", admin.id)
      .in("room_id", sharedRooms.map((r) => r.room_id));

    const roomIds = (adminRooms ?? []).map((r) => r.room_id);
    if (roomIds.length > 0) {
      await adminClient.from("rooms").delete().in("id", roomIds);
    }
  }

  const { error } = await adminClient.auth.admin.deleteUser(targetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
