import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/SettingsPanel";
import { getMyRoomMemberships } from "@/lib/rooms";
import type { Profile } from "@/lib/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }, { data: blockRows }, rows] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("settings").select("ttl_hours").eq("id", true).single(),
    supabase
      .from("blocks")
      .select("blocked_id, blocked:profiles!blocks_blocked_id_fkey(*)")
      .eq("blocker_id", user.id),
    getMyRoomMemberships(supabase),
  ]);

  if (!profile) redirect("/login");

  const myRemovedRoomIds = new Set(
    rows.filter((r) => r.user_id === user.id && r.friend_removed).map((r) => r.room_id),
  );
  const removedFriends = rows
    .filter((r) => myRemovedRoomIds.has(r.room_id) && r.user_id !== user.id && r.profile)
    .map((r) => ({ roomId: r.room_id, friend: r.profile as Profile }));

  const blocked = (blockRows as unknown as Array<{ blocked_id: string; blocked: Profile | null }> | null) ?? [];

  return (
    <SettingsPanel
      currentUserId={user.id}
      email={user.email ?? ""}
      displayName={profile.display_name}
      avatarEmoji={profile.avatar_emoji}
      avatarUrl={profile.avatar_url}
      ttlHours={settings?.ttl_hours ?? 24}
      showNotificationPreview={profile.show_notification_preview}
      xHandle={profile.x_handle}
      instagramHandle={profile.instagram_handle}
      blockedFriends={blocked.filter((b): b is { blocked_id: string; blocked: Profile } => !!b.blocked)}
      removedFriends={removedFriends}
    />
  );
}
