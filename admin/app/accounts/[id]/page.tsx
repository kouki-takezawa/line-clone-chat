import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import AdminHeader from "@/components/AdminHeader";
import AccountDetailActions from "@/components/AccountDetailActions";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_emoji: string | null;
  friend_code: string | null;
  x_handle: string | null;
  instagram_handle: string | null;
  is_system_bot: boolean;
};

function isBanned(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: userData, error: userError }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from("profiles").select("*").eq("id", id).single<ProfileRow>(),
  ]);

  if (userError || !userData?.user || !profile || profile.is_system_bot) {
    notFound();
  }
  const user = userData.user;

  const [{ count: roomCount }, { count: friendCount }, { count: messageCount }] = await Promise.all([
    admin.from("room_members").select("room_id", { count: "exact", head: true }).eq("user_id", id),
    admin
      .from("friend_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`from_user.eq.${id},to_user.eq.${id}`),
    admin.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", id),
  ]);

  const banned = isBanned(user.banned_until);
  const banReason = (user.app_metadata as { ban_reason?: string } | null)?.ban_reason ?? null;

  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto max-w-2xl">
        <AdminHeader title="アカウント詳細" back />

        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-3xl">
              {profile.avatar_emoji || "🙂"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{profile.display_name || "(表示名なし)"}</p>
              <p className="truncate text-sm text-white/50">{user.email}</p>
              {banned && (
                <p className="mt-1 text-sm text-red-400">
                  制限中{user.banned_until ? ` (解除: ${new Date(user.banned_until).toLocaleString("ja-JP")})` : ""}
                  {banReason ? ` — ${banReason}` : ""}
                </p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            {[
              ["友達コード", profile.friend_code || "-"],
              ["登録日", new Date(user.created_at).toLocaleDateString("ja-JP")],
              ["トーク数", String(roomCount ?? 0)],
              ["友達数", String(friendCount ?? 0)],
              ["保持中メッセージ数", String(messageCount ?? 0)],
              ["X", profile.x_handle ? `@${profile.x_handle}` : "-"],
              ["Instagram", profile.instagram_handle ? `@${profile.instagram_handle}` : "-"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 p-3">
                <dt className="text-xs text-white/40">{label}</dt>
                <dd className="mt-1 truncate">{value}</dd>
              </div>
            ))}
          </dl>

          <AccountDetailActions
            userId={id}
            displayName={profile.display_name || ""}
            banned={banned}
            banReason={banReason}
          />
        </div>
      </div>
    </main>
  );
}
