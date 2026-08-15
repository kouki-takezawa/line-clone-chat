import Link from "next/link";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type HistoryItem = { at: string; message: string; count: number | null; source: "即時配信" | "予約配信" };

export default async function BroadcastHistoryPage() {
  const admin = createAdminClient();

  const [{ data: auditRows }, { data: scheduledRows }] = await Promise.all([
    admin
      .from("admin_audit_log")
      .select("created_at, detail")
      .eq("action", "broadcast")
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<{ created_at: string; detail: string | null }[]>(),
    admin
      .from("scheduled_broadcasts")
      .select("sent_at, message")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(100)
      .returns<{ sent_at: string; message: string }[]>(),
  ]);

  const immediate: HistoryItem[] = (auditRows ?? []).flatMap((row): HistoryItem[] => {
    if (!row.detail) return [];
    try {
      const parsed = JSON.parse(row.detail) as { message: string; count: number };
      return [{ at: row.created_at, message: parsed.message, count: parsed.count, source: "即時配信" as const }];
    } catch {
      return [{ at: row.created_at, message: row.detail, count: null, source: "即時配信" as const }];
    }
  });

  const scheduled: HistoryItem[] = (scheduledRows ?? []).map((row) => ({
    at: row.sent_at,
    message: row.message,
    count: null,
    source: "予約配信" as const,
  }));

  const items = [...immediate, ...scheduled].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/broadcast" className="text-sm text-white/50 underline">
        ← 全体配信へ戻る
      </Link>
      <h1 className="mb-6 mt-1 text-2xl font-semibold">配信履歴</h1>

      {items.length === 0 ? (
        <p className="text-sm text-white/50">配信履歴はまだありません</p>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {items.map((item, i) => (
            <li key={i} className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/50">
                  {item.source}
                </span>
                <span className="text-xs text-white/40">{new Date(item.at).toLocaleString("ja-JP")}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{item.message}</p>
              {item.count !== null && <p className="mt-1 text-xs text-white/30">{item.count}件へ配信</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
