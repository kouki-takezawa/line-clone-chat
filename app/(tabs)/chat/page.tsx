import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendList from "@/components/FriendList";
import { getMyRoomMemberships } from "@/lib/rooms";
import type { Profile, RoomSummary } from "@/lib/types";

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
  // so neither query needs an explicit room_id filter — that lets them run
  // in a single parallel round trip. image_width/image_height aren't
  // selected: the talk list only ever needs "was this a photo" (image_path
  // alone answers that) for its one-line preview, never the dimensions.
  const [rows, { data: recentMessages }] = await Promise.all([
    getMyRoomMemberships(supabase),
    supabase
      .from("messages")
      .select("id, room_id, sender_id, body, image_path, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const friendByRoom = new Map<string, Profile>();
  const myPrefsByRoom = new Map<
    string,
    { pinned: boolean; talk_hidden: boolean; muted: boolean; last_read_at: string }
  >();
  for (const row of rows) {
    if (row.user_id === user.id) {
      myPrefsByRoom.set(row.room_id, {
        pinned: row.pinned,
        talk_hidden: row.talk_hidden,
        muted: row.muted,
        last_read_at: row.last_read_at,
      });
    } else if (row.profile) {
      friendByRoom.set(row.room_id, row.profile);
    }
  }

  // Messages arrive sorted newest-first, so the first occurrence per room is
  // already its most recent message.
  const lastByRoom = new Map<string, RoomSummary["lastMessage"]>();
  const unreadCountByRoom = new Map<string, number>();
  for (const message of recentMessages ?? []) {
    if (!lastByRoom.has(message.room_id)) {
      lastByRoom.set(message.room_id, { ...message, image_width: null, image_height: null });
    }
    const myLastRead = myPrefsByRoom.get(message.room_id)?.last_read_at;
    // Date comparison, not string comparison — see MessageList.tsx for why.
    if (
      message.sender_id !== user.id &&
      myLastRead &&
      new Date(message.created_at).getTime() > new Date(myLastRead).getTime()
    ) {
      unreadCountByRoom.set(message.room_id, (unreadCountByRoom.get(message.room_id) ?? 0) + 1);
    }
  }

  const rooms: RoomSummary[] = [...friendByRoom.entries()]
    .filter(([roomId]) => !myPrefsByRoom.get(roomId)?.talk_hidden)
    .map(([roomId, friend]) => ({
      id: roomId,
      friend,
      lastMessage: lastByRoom.get(roomId) ?? null,
      pinned: myPrefsByRoom.get(roomId)?.pinned ?? false,
      muted: myPrefsByRoom.get(roomId)?.muted ?? false,
      unreadCount: unreadCountByRoom.get(roomId) ?? 0,
    }))
    .sort((a, b) => {
      if (a.friend.is_system_bot !== b.friend.is_system_bot) return a.friend.is_system_bot ? -1 : 1;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const at = a.lastMessage?.created_at ?? "";
      const bt = b.lastMessage?.created_at ?? "";
      return bt.localeCompare(at);
    });

  return <FriendList rooms={rooms} currentUserId={user.id} />;
}
