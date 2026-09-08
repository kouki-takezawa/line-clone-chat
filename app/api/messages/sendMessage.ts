// Pure logic behind POST /api/messages, split out of route.ts so it can be
// unit tested without a Next.js request context (no next/server,
// next/headers, or server-only imports here — those live in route.ts).

export type SendMessageBody = {
  id: string;
  roomId: string;
  body?: string | null;
  imagePath?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
};

export type SendMessageResult =
  | { status: 200; body: { ok: true } }
  | { status: 400 | 401 | 500; body: { error: string } };

type MaybeError = { message: string } | null;

// Minimal shape used from the request's cookie-scoped Supabase client —
// RLS still applies through this client exactly as it did for the old
// direct-from-the-browser insert (room membership, blocked-pair checks).
export type MessageInsertClient = {
  from(table: "messages"): {
    // PromiseLike, not Promise — the real Supabase query builder is thenable
    // but isn't a native Promise (no catch/finally), so awaiting it is fine
    // but this interface must not demand more than that to stay assignable
    // from the real client.
    insert(row: Record<string, unknown>): PromiseLike<{ error: MaybeError }>;
  };
};

// Minimal shape used from the service-role client — bypasses RLS, which is
// required here because a sender can only update their own room_members
// row under RLS, but this must clear talk_hidden for every member of the
// room (see 0026/0027 migration history for why this used to be a trigger).
export type TalkUnhideClient = {
  from(table: "room_members"): {
    update(values: { talk_hidden: false }): {
      eq(column: "room_id", value: string): {
        eq(column: "talk_hidden", value: true): PromiseLike<unknown>;
      };
    };
  };
};

export async function sendMessage(
  supabase: MessageInsertClient,
  admin: TalkUnhideClient,
  senderId: string,
  payload: SendMessageBody,
): Promise<SendMessageResult> {
  const { id, roomId, body, imagePath, imageWidth, imageHeight } = payload;
  if (!id || !roomId || (!body && !imagePath)) {
    return { status: 400, body: { error: "invalid request" } };
  }

  const { error: insertError } = await supabase.from("messages").insert({
    id,
    room_id: roomId,
    sender_id: senderId,
    body: body ?? null,
    image_path: imagePath ?? null,
    image_width: imageWidth ?? null,
    image_height: imageHeight ?? null,
  });
  if (insertError) {
    return { status: 400, body: { error: insertError.message } };
  }

  // Un-hide the talk for whichever member(s) had it hidden — the sender
  // included, so re-sending into a talk you deleted un-hides it for you too.
  await admin.from("room_members").update({ talk_hidden: false }).eq("room_id", roomId).eq("talk_hidden", true);

  return { status: 200, body: { ok: true } };
}
