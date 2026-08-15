import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

type ProfileRow = { id: string; display_name: string | null };
type MessageRow = {
  id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
};

export default async function AccountTalkDetailPage({
  params,
}: {
  params: Promise<{ id: string; roomId: string }>;
}) {
  const { id, roomId } = await params;
  const admin = createAdminClient();

  const { data: members } = await admin
    .from("room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .returns<{ user_id: string }[]>();
  const memberIds = (members ?? []).map((m) => m.user_id);
  if (!memberIds.includes(id)) notFound();

  const otherId = memberIds.find((m) => m !== id);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds)
    .returns<ProfileRow[]>();
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name || "(表示名なし)"]));

  const { data: messages } = await admin
    .from("messages")
    .select("id, sender_id, body, image_path, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  const imageUrls = new Map<string, string>();
  for (const m of messages ?? []) {
    if (!m.image_path) continue;
    const { data } = await admin.storage.from("chat-images").createSignedUrl(m.image_path, 300);
    if (data) imageUrls.set(m.id, data.signedUrl);
  }

  await logAdminAction("view_talk", id, `相手: ${nameById.get(otherId ?? "") ?? "不明"}`);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/accounts/${id}/talks`} className="text-sm text-white/50 underline">
        ← トーク一覧へ戻る
      </Link>
      <h1 className="mb-1 mt-1 text-2xl font-semibold">
        {nameById.get(id)} ⇔ {nameById.get(otherId ?? "") ?? "不明"}
      </h1>
      <p className="mb-6 text-xs text-white/40">この閲覧は監査ログに記録されました。</p>

      {!messages || messages.length === 0 ? (
        <p className="text-sm text-white/50">メッセージがありません</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-white/10 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-white/40">
                <span>{nameById.get(m.sender_id) ?? "不明"}</span>
                <span>{new Date(m.created_at).toLocaleString("ja-JP")}</span>
              </div>
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
              {m.image_path && imageUrls.get(m.id) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrls.get(m.id)} alt="送信された画像" className="mt-1 max-h-64 rounded-lg" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
