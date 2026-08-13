import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendList from "@/components/FriendList";
import type { Profile, RoomSummary } from "@/lib/types";

type MemberRow = {
  room_id: string;
  user_id: string;
  pinned: boolean;
  talk_hidden: boolean;
  profile: Profile | null;
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
  // so none of these queries need an explicit room_id filter — that lets
  // them run in a single parallel round trip.
  const [{ data: allMembersRaw }, { data: recentMessages }] = await Promise.all([
    supabase.from("room_members").select("room_id, user_id, pinned, talk_hidden, profile:profiles(*)"),
    supabase.from("messages").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  const allMembers = allMembersRaw as unknown as MemberRow[] | null;

  const friendByRoom = new Map<string, Profile>();
  const myPrefsByRoom = new Map<string, { pinned: boolean; talk_hidden: boolean }>();
  for (const row of allMembers ?? []) {
    if (row.user_id === user.id) {
      myPrefsByRoom.set(row.room_id, { pinned: row.pinned, talk_hidden: row.talk_hidden });
    } else if (row.profile) {
      friendByRoom.set(row.room_id, row.profile);
    }
  }

  // Messages arrive sorted newest-first, so the first occurrence per room is
  // already its most recent message.
  const lastByRoom = new Map<string, RoomSummary["lastMessage"]>();
  for (const message of recentMessages ?? []) {
    if (!lastByRoom.has(message.room_id)) lastByRoom.set(message.room_id, message);
  }

  const rooms: RoomSummary[] = [...friendByRoom.entries()]
    .filter(([roomId]) => !myPrefsByRoom.get(roomId)?.talk_hidden)
    .map(([roomId, friend]) => ({
      id: roomId,
      friend,
      lastMessage: lastByRoom.get(roomId) ?? null,
      pinned: myPrefsByRoom.get(roomId)?.pinned ?? false,
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessage?.created_at ?? "";
      const bt = b.lastMessage?.created_at ?? "";
      return bt.localeCompare(at);
    });

  return <FriendList rooms={rooms} currentUserId={user.id} />;
}
