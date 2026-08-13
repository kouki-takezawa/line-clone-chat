import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/SettingsPanel";

export default async function SettingsPage() {
  const supabase = await createClient();
  // getSession() avoids the extra Auth-server round trip getUser() makes on
  // every call. Safe here: this page's own gate is just UX — the actual
  // privileged operations in SettingsPanel all go through /api/admin/*
  // routes, which re-check admin status server-side via getUser().
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/chat");

  return <SettingsPanel currentUserId={user.id} />;
}
