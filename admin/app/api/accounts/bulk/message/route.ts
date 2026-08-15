import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown): v is string => typeof v === "string") : [];
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 1000) : "";
  if (ids.length === 0 || !message) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
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

  const { data: botRooms } = await admin
    .from("room_members")
    .select("room_id")
    .eq("user_id", botProfile.id)
    .returns<{ room_id: string }[]>();
  const botRoomIds = new Set((botRooms ?? []).map((r) => r.room_id));

  let succeeded = 0;
  for (const id of ids) {
    const { data: userRooms } = await admin
      .from("room_members")
      .select("room_id")
      .eq("user_id", id)
      .returns<{ room_id: string }[]>();
    const sharedRoomId = (userRooms ?? []).map((r) => r.room_id).find((roomId) => botRoomIds.has(roomId));
    if (!sharedRoomId) continue;

    const { error: insertError } = await admin
      .from("messages")
      .insert({ room_id: sharedRoomId, sender_id: botProfile.id, body: message });
    if (!insertError) {
      succeeded += 1;
      await logAdminAction("message", id, message);
    }
  }

  return NextResponse.json({ succeeded, total: ids.length });
}
