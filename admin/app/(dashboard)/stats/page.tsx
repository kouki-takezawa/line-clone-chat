import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const TREND_DAYS = 14;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function StatsPage() {
  const admin = createAdminClient();

  const [{ data: usersData }, { data: botProfiles }, { data: imageRows }, { count: messageCount }, { data: avatarFiles }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 200 }),
      admin.from("profiles").select("id").eq("is_system_bot", true).returns<{ id: string }[]>(),
      admin.from("messages").select("room_id").not("image_path", "is", null).returns<{ room_id: string }[]>(),
      admin.from("messages").select("id", { count: "exact", head: true }),
      admin.storage.from("avatars").list(undefined, { limit: 200 }),
    ]);

  const botIds = new Set((botProfiles ?? []).map((p) => p.id));
  const realUsers = (usersData?.users ?? []).filter((u) => !botIds.has(u.id));

  const trend: { date: string; count: number }[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const count = realUsers.filter((u) => {
      const t = new Date(u.created_at).getTime();
      return t >= day.getTime() && t < next.getTime();
    }).length;
    trend.push({ date: `${day.getMonth() + 1}/${day.getDate()}`, count });
  }
  const maxTrend = Math.max(1, ...trend.map((t) => t.count));

  const roomIdsWithImages = Array.from(new Set((imageRows ?? []).map((r) => r.room_id)));
  const imageListings = await Promise.all(
    roomIdsWithImages.map((roomId) => admin.storage.from("chat-images").list(roomId, { limit: 200 })),
  );
  let imageBytes = 0;
  let imageCount = 0;
  for (const listing of imageListings) {
    for (const file of listing.data ?? []) {
      imageBytes += file.metadata?.size ?? 0;
      imageCount += 1;
    }
  }

  const avatarBytes = (avatarFiles ?? []).reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">統計</h1>

      <section className="rounded-xl border border-white/10 p-4">
        <h2 className="mb-3 text-sm font-medium text-white/70">登録者数の推移(直近{TREND_DAYS}日)</h2>
        <div className="flex h-32 items-end gap-1">
          {trend.map((t) => (
            <div key={t.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-white/70"
                style={{ height: `${Math.max(4, (t.count / maxTrend) * 100)}%` }}
                title={`${t.date}: ${t.count}件`}
              />
              <span className="text-[10px] text-white/30">{t.date}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/40">保持中メッセージ数</p>
          <p className="mt-1 text-2xl font-semibold">{messageCount ?? 0}</p>
          <p className="mt-1 text-xs text-white/30">24時間TTLにより随時削除</p>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/40">保持中の画像</p>
          <p className="mt-1 text-2xl font-semibold">{imageCount}</p>
          <p className="mt-1 text-xs text-white/30">{formatBytes(imageBytes)}</p>
        </div>
        <div className="rounded-xl border border-white/10 p-4">
          <p className="text-xs text-white/40">プロフィール画像</p>
          <p className="mt-1 text-2xl font-semibold">{(avatarFiles ?? []).length}</p>
          <p className="mt-1 text-xs text-white/30">{formatBytes(avatarBytes)}</p>
        </div>
      </div>

      <p className="text-xs text-white/30">
        Supabase無料枠のストレージ上限は1GBです。上記は現時点でDB/Storageに残っているデータのみの概算値です。
      </p>
    </div>
  );
}
