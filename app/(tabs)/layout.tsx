import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomTabBar from "@/components/BottomTabBar";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .single();

  return (
    // position: fixed pins this shell to the actual viewport instead of
    // sizing off document flow (min-h-dvh is only a minimum — if content
    // ever pushed the page taller, the whole body would scroll and drag
    // the tab bar down with it). The bottom-14 gap plus each scrollable
    // area's own bottom padding keep content clear of the fixed tab bar.
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      <BottomTabBar isAdmin={profile?.is_admin ?? false} />
    </div>
  );
}
