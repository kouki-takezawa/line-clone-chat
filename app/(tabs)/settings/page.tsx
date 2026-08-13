import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/SettingsPanel";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("settings").select("ttl_hours").eq("id", true).single(),
  ]);

  if (!profile) redirect("/login");

  return (
    <SettingsPanel
      currentUserId={user.id}
      email={user.email ?? ""}
      displayName={profile.display_name}
      avatarEmoji={profile.avatar_emoji}
      avatarUrl={profile.avatar_url}
      ttlHours={settings?.ttl_hours ?? 24}
    />
  );
}
