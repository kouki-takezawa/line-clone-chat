import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type ProfileRow = { id: string; display_name: string | null; is_system_bot: boolean };
type RoomMemberRow = { room_id: string; user_id: string };
type MessageRow = { room_id: string; body: string | null; image_path: string | null; created_at: string };

export default async function AccountTalksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("id, display_name, is_system_bot")
    .eq("id", id)
    .single<ProfileRow>();
  if (!targetProfile || targetProfile.is_system_bot) notFound();

  const { data: myRooms } = await admin
    .from("room_members")
    .select("room_id, user_id")
    .eq("user_id", id)
    .returns<RoomMemberRow[]>();
  const roomIds = (myRooms ?? []).map((r) => r.room_id);

  if (roomIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href={`/accounts/${id}`} className="text-sm text-white/50 underline">
          ← アカウント詳細へ戻る
        </Link>
        <h1 className="mb-6 mt-1 text-2xl font-semibold">{targetProfile.display_name || "(表示名なし)"} のトーク</h1>
        <p className="text-sm text-white/50">トークがありません</p>
      </div>
    );
  }

  const { data: otherMembers } = await admin
    .from("room_members")
    .select("room_id, user_id")
    .in("room_id", roomIds)
    .neq("user_id", id)
    .returns<RoomMemberRow[]>();

  const otherIds = Array.from(new Set((otherMembers ?? []).map((m) => m.user_id)));
  const { data: otherProfiles } = otherIds.length
    ? await admin.from("profiles").select("id, display_name, is_system_bot").in("id", otherIds).returns<ProfileRow[]>()
    : { data: [] };
  const profileById = new Map((otherProfiles ?? []).map((p) => [p.id, p]));

  const otherByRoom = new Map<string, ProfileRow>();
  for (const m of otherMembers ?? []) {
    const p = profileById.get(m.user_id);
    if (p) otherByRoom.set(m.room_id, p);
  }

  // Exclude the announcements bot's own talk — not relevant for moderation.
  const moderationRoomIds = roomIds.filter((rid) => !otherByRoom.get(rid)?.is_system_bot);

  const { data: recentMessages } = await admin
    .from("messages")
    .select("room_id, body, image_path, created_at")
    .in("room_id", moderationRoomIds)
    .order("created_at", { ascending: false })
    .returns<MessageRow[]>();

  const lastByRoom = new Map<string, MessageRow>();
  const countByRoom = new Map<string, number>();
  for (const m of recentMessages ?? []) {
    if (!lastByRoom.has(m.room_id)) lastByRoom.set(m.room_id, m);
    countByRoom.set(m.room_id, (countByRoom.get(m.room_id) ?? 0) + 1);
  }

  const rooms = moderationRoomIds
    .map((rid) => ({
      roomId: rid,
      other: otherByRoom.get(rid),
      last: lastByRoom.get(rid) ?? null,
      count: countByRoom.get(rid) ?? 0,
    }))
    .filter((r) => r.other)
    .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/accounts/${id}`} className="text-sm text-white/50 underline">
        ← アカウント詳細へ戻る
      </Link>
      <h1 className="mb-2 mt-1 text-2xl font-semibold">{targetProfile.display_name || "(表示名なし)"} のトーク</h1>
      <p className="mb-6 text-xs text-white/40">
        現在DBに残っているメッセージのみ表示されます(24時間TTLで自動削除されるため)。閲覧は監査ログに記録されます。
      </p>

      {rooms.length === 0 ? (
        <p className="text-sm text-white/50">トークがありません</p>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {rooms.map((r) => (
            <li key={r.roomId}>
              <Link href={`/accounts/${id}/talks/${r.roomId}`} className="flex items-center gap-3 p-4 text-sm hover:bg-white/5">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.other?.display_name || "(表示名なし)"}</p>
                  <p className="truncate text-white/50">
                    {r.last ? (r.last.body || (r.last.image_path ? "[画像]" : "")) : "(メッセージなし)"}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-white/40">
                  <p>{r.last ? new Date(r.last.created_at).toLocaleString("ja-JP") : ""}</p>
                  <p>{r.count}件</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
