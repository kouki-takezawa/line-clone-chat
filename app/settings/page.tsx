import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/SettingsPanel";

export default async function SettingsPage() {
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

  if (!profile?.is_admin) redirect("/chat");

  return <SettingsPanel currentUserId={user.id} />;
}
