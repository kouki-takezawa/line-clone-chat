import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatRoom from "@/components/ChatRoom";
import type { MessageReaction, MessageWithSender, Profile } from "@/lib/types";

export default async function TalkPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const supabase = await createClient();
  // getSession() avoids the extra Auth-server round trip getUser() makes on
  // every call — safe here since every query below is still RLS-scoped by
  // the request's actual JWT, not by this id.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) redirect("/login");

  // No separate membership pre-check: RLS already restricts room_members to
  // rows the caller can see, so a non-member's memberRows fetch comes back
  // empty and "friend" ends up undefined below — same 404 outcome, one
  // fewer round trip.
  const [{ data: memberRowsRaw }, { data: messages }, { data: settings }] = await Promise.all([
    supabase
      .from("room_members")
      .select("user_id, last_read_at, muted, profile:profiles(*)")
      .eq("room_id", roomId),
    supabase
      .from("messages")
      // profiles is ambiguous from messages since message_reactions added a
      // second (indirect) path to it — must name the FK explicitly.
      .select("*, sender:profiles!messages_sender_id_fkey(*)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true }),
    supabase.from("settings").select("ttl_hours").eq("id", true).single(),
  ]);
  const memberRows = memberRowsRaw as unknown as Array<{
    user_id: string;
    last_read_at: string;
    muted: boolean;
    profile: Profile | null;
  }> | null;

  const members = (memberRows ?? [])
    .map((row) => row.profile)
    .filter((p): p is Profile => !!p);

  const friend = members.find((m) => m.id !== user.id);
  if (!friend) notFound();

  const myRow = memberRows?.find((row) => row.user_id === user.id);
  const friendRow = memberRows?.find((row) => row.user_id === friend.id);

  const messageIds = (messages ?? []).map((m) => m.id);
  const { data: reactions } =
    messageIds.length > 0
      ? await supabase.from("message_reactions").select("*").in("message_id", messageIds)
      : { data: [] as MessageReaction[] };

  return (
    <ChatRoom
      roomId={roomId}
      currentUserId={user.id}
      friend={friend}
      members={members}
      initialMessages={(messages as unknown as MessageWithSender[]) ?? []}
      initialReactions={reactions ?? []}
      ttlHours={settings?.ttl_hours ?? 24}
      initialFriendLastReadAt={friendRow?.last_read_at ?? null}
      initialMuted={myRow?.muted ?? false}
    />
  );
}
