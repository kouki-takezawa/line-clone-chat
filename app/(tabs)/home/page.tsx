import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeFriendList from "@/components/HomeFriendList";
import type { Profile } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  // RLS scopes this to room_members rows for rooms the caller is in, so no
  // explicit filter is needed.
  const { data: allMembersRaw } = await supabase
    .from("room_members")
    .select("room_id, user_id, friend_removed, profile:profiles(*)");
  const allMembers = allMembersRaw as unknown as Array<{
    room_id: string;
    user_id: string;
    friend_removed: boolean;
    profile: Profile | null;
  }> | null;

  // A room has exactly one other member (1:1 rooms), so whether *my own*
  // row for that room has friend_removed set is what decides whether the
  // room's other member still shows up in my list — the other member's own
  // row for the same room is irrelevant here.
  const myHiddenRooms = new Set(
    (allMembers ?? []).filter((r) => r.user_id === user.id && r.friend_removed).map((r) => r.room_id),
  );

  const friends = new Map<string, { roomId: string; friend: Profile }>();
  let me: Profile | null = null;
  for (const row of allMembers ?? []) {
    if (row.user_id === user.id && row.profile) {
      me = row.profile;
    } else if (row.profile && !myHiddenRooms.has(row.room_id)) {
      friends.set(row.profile.id, { roomId: row.room_id, friend: row.profile });
    }
  }

  const { data: incomingRequests } = await supabase.rpc("list_incoming_friend_requests");
  const pendingRequestCount = incomingRequests?.length ?? 0;

  // A user with no rooms yet (fresh account, no friends added) won't appear
  // in room_members at all — fall back to fetching their profile directly.
  if (!me) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    me = data;
  }
  if (!me) redirect("/login");

  const list = [...friends.values()].sort((a, b) =>
    a.friend.display_name.localeCompare(b.friend.display_name, "ja"),
  );

  return <HomeFriendList me={me} friends={list} pendingRequestCount={pendingRequestCount} />;
}
