import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  action: string;
  target_user_id: string | null;
  detail: string | null;
  admin_username: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  restrict: "制限",
  unrestrict: "制限解除",
  delete: "削除",
  rename: "表示名変更",
  message: "個別メッセージ",
  broadcast: "全体配信",
  admin_create: "管理者追加",
  admin_delete: "管理者削除",
  broadcast_schedule: "配信予約",
  broadcast_cancel: "予約配信キャンセル",
  restrict_friends: "友達追加を制限",
  unrestrict_friends: "友達追加の制限を解除",
  restrict_messaging: "トーク送信を制限",
  unrestrict_messaging: "トーク送信の制限を解除",
  view_talk: "トーク内容を閲覧",
};

function formatDetail(action: string, detail: string): string {
  if (action !== "broadcast") return detail;
  try {
    const parsed = JSON.parse(detail) as { message: string; count: number };
    return `[${parsed.count}件へ配信] ${parsed.message}`;
  } catch {
    return detail;
  }
}

export default async function AuditLogPage() {
  const admin = createAdminClient();
  const { data: logs } = await admin
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<AuditRow[]>();

  const targetIds = Array.from(new Set((logs ?? []).map((l) => l.target_user_id).filter(Boolean))) as string[];
  const { data: profiles } = targetIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", targetIds).returns<{ id: string; display_name: string | null }[]>()
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">監査ログ</h1>
      {!logs || logs.length === 0 ? (
        <p className="text-sm text-white/50">記録はまだありません</p>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {logs.map((log) => (
            <li key={log.id} className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</span>
                <span className="text-xs text-white/40">{new Date(log.created_at).toLocaleString("ja-JP")}</span>
              </div>
              <p className="mt-1 text-xs text-white/30">操作者: {log.admin_username || "不明"}</p>
              {log.target_user_id && (
                <p className="mt-1 text-white/60">対象: {nameById.get(log.target_user_id) || log.target_user_id}</p>
              )}
              {log.detail && (
                <p className="mt-1 whitespace-pre-wrap text-white/50">{formatDetail(log.action, log.detail)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
