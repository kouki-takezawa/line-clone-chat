import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

// Sends a single message from the announcements bot into this user's
// existing bot room (created automatically for every user — see
// supabase/migrations/0020_admin_bot_and_restrictions.sql).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (!message) {
    return NextResponse.json({ error: "メッセージを入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: botProfile, error: botError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_system_bot", true)
    .single<{ id: string }>();
  if (botError || !botProfile) {
    return NextResponse.json({ error: "システムBotが設定されていません" }, { status: 500 });
  }

  const { data: userRooms } = await admin
    .from("room_members")
    .select("room_id")
    .eq("user_id", id)
    .returns<{ room_id: string }[]>();
  const { data: botRooms } = await admin
    .from("room_members")
    .select("room_id")
    .eq("user_id", botProfile.id)
    .returns<{ room_id: string }[]>();

  const botRoomIds = new Set((botRooms ?? []).map((r) => r.room_id));
  const sharedRoomId = (userRooms ?? []).map((r) => r.room_id).find((roomId) => botRoomIds.has(roomId));
  if (!sharedRoomId) {
    return NextResponse.json({ error: "このユーザーとのBotルームが見つかりません" }, { status: 404 });
  }

  const { error: insertError } = await admin
    .from("messages")
    .insert({ room_id: sharedRoomId, sender_id: botProfile.id, body: message });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logAdminAction("message", id, message);
  return NextResponse.json({ ok: true });
}
