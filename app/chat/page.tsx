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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("user_id", user.id);

  const roomIds = (memberships ?? []).map((m) => m.room_id);
  let rooms: RoomSummary[] = [];

  if (roomIds.length > 0) {
    const { data: allMembersRaw } = await supabase
      .from("room_members")
      .select("room_id, profile:profiles(*)")
      .in("room_id", roomIds);
    const allMembers = allMembersRaw as unknown as Array<{
      room_id: string;
      profile: Profile | null;
    }> | null;

    const friendByRoom = new Map<string, Profile>();
    for (const row of allMembers ?? []) {
      const p = row.profile;
      if (p && p.id !== user.id) friendByRoom.set(row.room_id, p);
    }

    const lastMessages = await Promise.all(
      roomIds.map((roomId) =>
        supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => [roomId, data] as const),
      ),
    );
    const lastByRoom = new Map(lastMessages);

    rooms = roomIds
      .map((roomId) => {
        const friend = friendByRoom.get(roomId);
        if (!friend) return null;
        return { id: roomId, friend, lastMessage: lastByRoom.get(roomId) ?? null };
      })
      .filter((r): r is RoomSummary => !!r)
      .sort((a, b) => {
        const at = a.lastMessage?.created_at ?? "";
        const bt = b.lastMessage?.created_at ?? "";
        return bt.localeCompare(at);
      });
  }

  return (
    <FriendList
      rooms={rooms}
      currentUserId={user.id}
      isAdmin={profile?.is_admin ?? false}
    />
  );
}
