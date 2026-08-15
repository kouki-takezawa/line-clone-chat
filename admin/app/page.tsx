import { createAdminClient } from "@/lib/supabaseAdmin";
import AccountList, { type Account } from "@/components/AccountList";
import AdminHeader from "@/components/AdminHeader";

export const dynamic = "force-dynamic";

const REGISTRATION_CAP = 110;

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

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const registeredToday = accounts.filter((a) => new Date(a.createdAt).getTime() >= todayStart.getTime()).length;
  const restrictedCount = accounts.filter((a) => a.bannedUntil && new Date(a.bannedUntil).getTime() > now).length;
  const capPct = Math.min(100, Math.round((accounts.length / REGISTRATION_CAP) * 100));

  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto max-w-3xl">
        <AdminHeader title="管理画面" />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs text-white/40">総登録数</p>
            <p className="mt-1 text-2xl font-semibold">{accounts.length}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-white" style={{ width: `${capPct}%` }} />
            </div>
            <p className="mt-1 text-xs text-white/30">上限 {REGISTRATION_CAP}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs text-white/40">本日の新規登録</p>
            <p className="mt-1 text-2xl font-semibold">{registeredToday}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs text-white/40">制限中</p>
            <p className="mt-1 text-2xl font-semibold">{restrictedCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 p-4">
            <p className="text-xs text-white/40">残り登録枠</p>
            <p className="mt-1 text-2xl font-semibold">{Math.max(0, REGISTRATION_CAP - accounts.length)}</p>
          </div>
        </div>

        <AccountList accounts={accounts} />
      </div>
    </main>
  );
}
