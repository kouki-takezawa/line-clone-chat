import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendProfile from "@/components/FriendProfile";
import type { Profile } from "@/lib/types";

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const { friendId } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  // RLS scopes room_members to rooms the caller is in, so this only finds
  // a room if the two actually share one — no separate membership check.
  const { data: memberRows } = await supabase
    .from("room_members")
    .select("room_id, user_id, profile:profiles(*)");
  const rows = memberRows as unknown as Array<{
    room_id: string;
    user_id: string;
    profile: Profile | null;
  }> | null;

  const roomsByFriend = new Map<string, string>(); // friendId -> roomId, only for rooms I'm also in
  const myRoomIds = new Set((rows ?? []).filter((r) => r.user_id === user.id).map((r) => r.room_id));
  for (const row of rows ?? []) {
    if (myRoomIds.has(row.room_id) && row.user_id !== user.id) {
      roomsByFriend.set(row.user_id, row.room_id);
    }
  }

  const friend = (rows ?? []).find((r) => r.user_id === friendId)?.profile;
  const sharedRoomId = roomsByFriend.get(friendId);

  if (!friend || !sharedRoomId) notFound();

  return <FriendProfile friend={friend} roomId={sharedRoomId} currentUserId={user.id} />;
}
