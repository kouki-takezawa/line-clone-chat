import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyProfile from "@/components/MyProfile";

export default async function MyProfilePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  return <MyProfile profile={profile} />;
}
