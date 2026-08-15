import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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

  const { data: botRooms, error: roomsError } = await admin
    .from("room_members")
    .select("room_id")
    .eq("user_id", botProfile.id)
    .returns<{ room_id: string }[]>();
  if (roomsError) {
    return NextResponse.json({ error: roomsError.message }, { status: 500 });
  }

  const roomIds = (botRooms ?? []).map((r) => r.room_id);
  if (roomIds.length === 0) {
    return NextResponse.json({ sentCount: 0 });
  }

  const rows = roomIds.map((roomId) => ({ room_id: roomId, sender_id: botProfile.id, body: message }));
  const { error: insertError } = await admin.from("messages").insert(rows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logAdminAction("broadcast", undefined, message);
  return NextResponse.json({ sentCount: roomIds.length });
}
