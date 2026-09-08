import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SendMessageBody = {
  id: string;
  roomId: string;
  body?: string | null;
  imagePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

// Sends a message, then un-hides the talk for anyone who had it hidden via
// トーク削除 — this used to be a DB trigger (0026_reinstate_unhide_on_new_message.sql,
// dropped in 0027) but lives here instead so the "new message un-hides the
// talk" rule is app code, not a Postgres trigger.
//
// The insert itself runs through the request's own cookie-scoped client, so
// every existing RLS check (room membership, blocked-pair) still applies
// exactly as before. Only the follow-up talk_hidden reset needs the admin
// client, since a sender is only allowed to update their own room_members
// row under RLS but this must clear it for every member of the room.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, roomId, body, imagePath, imageWidth, imageHeight } = (await req.json()) as SendMessageBody;
  if (!id || !roomId || (!body && !imagePath)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("messages").insert({
    id,
    room_id: roomId,
    sender_id: user.id,
    body: body ?? null,
    image_path: imagePath ?? null,
    image_width: imageWidth ?? null,
    image_height: imageHeight ?? null,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const admin = createAdminClient();
  await admin.from("room_members").update({ talk_hidden: false }).eq("room_id", roomId).eq("talk_hidden", true);

  return NextResponse.json({ ok: true });
}
