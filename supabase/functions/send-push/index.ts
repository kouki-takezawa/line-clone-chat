// Sends a Web Push notification to every room member (except the sender)
// who has notifications turned on, whenever a new message is inserted.
// Triggered by a Supabase Database Webhook on messages INSERT (see
// supabase/post_deploy.sql). Deployed with --no-verify-jwt since the
// webhook calls it without a user JWT; a shared secret header guards it.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!, // e.g. "mailto:you@example.com"
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  const secret = Deno.env.get("FUNCTION_SECRET");
  if (secret && req.headers.get("x-function-secret") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json();
  const message = payload.record;
  if (!message) return new Response("no record", { status: 400 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: sender } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", message.sender_id)
    .single();

  const { data: recipients } = await supabase
    .from("room_members")
    .select("user_id")
    .eq("room_id", message.room_id)
    .neq("user_id", message.sender_id);

  if (!recipients || recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", recipients.map((r) => r.user_id));

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const title = sender?.display_name ?? "新着メッセージ";
  const body = message.body
    ? (message.body as string).slice(0, 80)
    : "画像を送信しました";

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body }),
      )
    ),
  );

  const staleIds: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const statusCode = result.reason?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        staleIds.push(subs[i].id);
      } else {
        console.error("push send error", result.reason);
      }
    }
  });

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return new Response(
    JSON.stringify({ sent: results.filter((r) => r.status === "fulfilled").length }),
    { status: 200 },
  );
});
