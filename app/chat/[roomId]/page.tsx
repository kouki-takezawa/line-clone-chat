import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatRoom from "@/components/ChatRoom";
import type { MessageWithSender, Profile } from "@/lib/types";

export default async function TalkPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  // RLS already blocks reading rooms you're not in; this just gives a
  // proper 404 instead of an empty/broken screen for a stale or foreign link.
  if (!membership) notFound();

  const { data: memberRowsRaw } = await supabase
    .from("room_members")
    .select("profile:profiles(*)")
    .eq("room_id", roomId);
  const memberRows = memberRowsRaw as unknown as Array<{ profile: Profile | null }> | null;

  const members = (memberRows ?? [])
    .map((row) => row.profile)
    .filter((p): p is Profile => !!p);

  const friend = members.find((m) => m.id !== user.id);
  if (!friend) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("*, sender:profiles(*)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  return (
    <ChatRoom
      roomId={roomId}
      currentUserId={user.id}
      friend={friend}
      members={members}
      initialMessages={(messages as unknown as MessageWithSender[]) ?? []}
    />
  );
}
