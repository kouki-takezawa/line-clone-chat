import Link from "next/link";
import { createAdminClient } from "@/lib/supabaseAdmin";
import AccountList, { type Account } from "@/components/AccountList";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  display_name: string | null;
  friend_code: string | null;
  is_system_bot: boolean;
};

export default async function DashboardPage() {
  const admin = createAdminClient();
  const [{ data: usersData }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("profiles").select("id, display_name, friend_code, is_system_bot").returns<ProfileRow[]>(),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const accounts: Account[] = (usersData?.users ?? [])
    .filter((u) => !profileById.get(u.id)?.is_system_bot)
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      bannedUntil: u.banned_until ?? null,
      displayName: profileById.get(u.id)?.display_name ?? "",
      friendCode: profileById.get(u.id)?.friend_code ?? "",
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">管理画面</h1>
          <div className="flex gap-3">
            <Link href="/broadcast" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
              全体配信
            </Link>
            <LogoutButton />
          </div>
        </div>
        <p className="text-sm text-white/50">登録アカウント数: {accounts.length} / 110</p>
        <AccountList accounts={accounts} />
      </div>
    </main>
  );
}
