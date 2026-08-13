import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendList from "@/components/FriendList";
import type { Message, Profile } from "@/lib/types";

export type RoomSummary = {
  id: string;
  friend: Profile;
  lastMessage: Message | null;
};

export default async function ChatListPage() {
  const supabase = await createClient();
  // getSession() avoids the extra Auth-server round trip getUser() makes on
  // every call — safe here since every query below is still RLS-scoped by
  // the request's actual JWT, not by this id.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) redirect("/login");

  // RLS already restricts room_members/messages to rows the caller can see,
  // so none of these three queries need an explicit room_id filter — that
  // lets all three run in a single parallel round trip instead of the
  // previous profile -> memberships -> per-room-members -> per-room-message
  // chain (up to 3 sequential hops plus one per room).
  const [{ data: profile }, { data: allMembersRaw }, { data: recentMessages }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("room_members").select("room_id, profile:profiles(*)"),
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const allMembers = allMembersRaw as unknown as Array<{
    room_id: string;
    profile: Profile | null;
  }> | null;

  const friendByRoom = new Map<string, Profile>();
  for (const row of allMembers ?? []) {
    const p = row.profile;
    if (p && p.id !== user.id) friendByRoom.set(row.room_id, p);
  }

  // Messages arrive sorted newest-first, so the first occurrence per room is
  // already its most recent message.
  const lastByRoom = new Map<string, Message>();
  for (const message of recentMessages ?? []) {
    if (!lastByRoom.has(message.room_id)) lastByRoom.set(message.room_id, message);
  }

  const rooms: RoomSummary[] = [...friendByRoom.entries()]
    .map(([roomId, friend]) => ({ id: roomId, friend, lastMessage: lastByRoom.get(roomId) ?? null }))
    .sort((a, b) => {
      const at = a.lastMessage?.created_at ?? "";
      const bt = b.lastMessage?.created_at ?? "";
      return bt.localeCompare(at);
    });

  return (
    <FriendList
      rooms={rooms}
      currentUserId={user.id}
      isAdmin={profile?.is_admin ?? false}
    />
  );
}
