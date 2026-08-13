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
    .select("room_id, user_id, profile:profiles(*)");
  const allMembers = allMembersRaw as unknown as Array<{
    room_id: string;
    user_id: string;
    profile: Profile | null;
  }> | null;

  const friends = new Map<string, { roomId: string; friend: Profile }>();
  for (const row of allMembers ?? []) {
    if (row.user_id !== user.id && row.profile) {
      friends.set(row.profile.id, { roomId: row.room_id, friend: row.profile });
    }
  }

  const list = [...friends.values()].sort((a, b) =>
    a.friend.display_name.localeCompare(b.friend.display_name, "ja"),
  );

  return <HomeFriendList friends={list} />;
}
