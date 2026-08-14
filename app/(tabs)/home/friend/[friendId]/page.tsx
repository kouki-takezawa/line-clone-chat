import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendProfile from "@/components/FriendProfile";
import { getMyRoomMemberships, splitByViewer } from "@/lib/rooms";

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
  const rows = await getMyRoomMemberships(supabase);
  const { others } = splitByViewer(rows, user.id);
  const friendRow = [...others.values()].find((r) => r.user_id === friendId);

  if (!friendRow?.profile) notFound();

  return <FriendProfile friend={friendRow.profile} roomId={friendRow.room_id} currentUserId={user.id} />;
}
