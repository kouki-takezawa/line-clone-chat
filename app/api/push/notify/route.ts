import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushSubscriptionRow } from "@/lib/types";

type NotifyBody =
  | { type: "message"; roomId: string; body: string }
  | { type: "friend_request"; toUserId: string }
  | { type: "friend_accepted"; toUserId: string };

async function sendToUser(userId: string, title: string, body: string, roomId?: string) {
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs || subs.length === 0) return;

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPrivateKey || !vapidPublicKey) return;
  webpush.setVapidDetails("mailto:support@example.com", vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({ title, body, roomId });
  await Promise.all(
    (subs as PushSubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err) {
        // 404/410 = the subscription is gone (browser unsubscribed, expired,
        // etc.) — stop trying to deliver to it. Any other error is
        // transient/unrelated and shouldn't delete a still-valid subscription.
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as NotifyBody;

  if (body.type === "message") {
    // RLS-scoped: only returns rows if the caller is actually a member of
    // this room, which doubles as the authorization check for this call.
    const { data: memberRows } = await supabase
      .from("room_members")
      .select("user_id, muted")
      .eq("room_id", body.roomId);
    const recipient = memberRows?.find((m) => m.user_id !== user.id);
    if (!recipient || recipient.muted) {
      return NextResponse.json({ ok: true });
    }

    const [{ data: senderProfile }, { data: recipientProfile }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).single(),
      // service-role: the recipient's own preference isn't visible to the
      // sender under normal RLS ("update own profile" is the only policy),
      // and this route needs to read it to decide what the recipient sees.
      createAdminClient().from("profiles").select("show_notification_preview").eq("id", recipient.user_id).single(),
    ]);

    const title = senderProfile?.display_name ?? "新着メッセージ";
    const previewBody = recipientProfile?.show_notification_preview === false ? "新着メッセージがあります" : body.body.slice(0, 200);

    await sendToUser(recipient.user_id, title, previewBody, body.roomId);
    return NextResponse.json({ ok: true });
  }

  if (body.type === "friend_accepted") {
    // Only notify if the caller really is the to_user of an accepted
    // request from this from_user — RLS lets the caller see their own
    // received requests, so this confirms it's a real acceptance.
    const { data: existing } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("from_user", body.toUserId)
      .eq("to_user", user.id)
      .eq("status", "accepted")
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ ok: true });
    }

    const { data: accepterProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    await sendToUser(body.toUserId, "友達申請が承認されました", `${accepterProfile?.display_name ?? "相手"}さんと友達になりました`);
    return NextResponse.json({ ok: true });
  }

  if (body.type === "friend_request") {
    // Only notify if a matching pending request actually exists — RLS lets
    // the caller see their own outgoing requests, so this confirms the
    // notification corresponds to a real request rather than an arbitrary
    // target chosen by the client.
    const { data: existing } = await supabase
      .from("friend_requests")
      .select("id")
      .eq("from_user", user.id)
      .eq("to_user", body.toUserId)
      .eq("status", "pending")
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ ok: true });
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    await sendToUser(body.toUserId, "友達申請", `${senderProfile?.display_name ?? "誰か"}さんから友達申請が届きました`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid type" }, { status: 400 });
}
