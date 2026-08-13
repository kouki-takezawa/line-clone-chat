"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avatarColorFor } from "@/lib/avatarColor";
import type { RoomSummary } from "@/app/chat/page";
import NotificationToggle from "@/components/NotificationToggle";

type Props = {
  rooms: RoomSummary[];
  currentUserId: string;
  isAdmin: boolean;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function lastMessageLabel(message: RoomSummary["lastMessage"]) {
  if (!message) return "";
  if (message.body) return message.body;
  if (message.image_path) return "[画像]";
  return "";
}

export default function FriendList({ rooms, currentUserId, isAdmin }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // replace() alone already fetches /login fresh (reading the now-cleared
    // session cookie); a follow-up refresh() would just re-fetch it again.
    router.replace("/login");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between bg-[#06C755] px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">トーク</h1>
        <div className="flex items-center gap-2">
          <NotificationToggle currentUserId={currentUserId} />
          {isAdmin && (
            <Link
              href="/settings"
              title="設定（管理者のみ）"
              className="rounded-full bg-white/15 px-3 py-1 text-sm"
            >
              ⚙️ 設定
            </Link>
          )}
          <button onClick={handleSignOut} className="rounded-full bg-white/15 px-3 py-1 text-sm">
            ログアウト
          </button>
        </div>
      </header>

      {rooms.length === 0 ? (
        <p className="flex-1 p-6 text-center text-sm text-black/50 dark:text-white/50">
          まだ友達が追加されていません。
          {isAdmin && (
            <>
              <br />
              <Link href="/settings" className="underline">
                設定
              </Link>
              から友達を追加してください。
            </>
          )}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto dark:divide-white/10">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/chat/${room.id}`}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${avatarColorFor(room.friend.id)}`}
                >
                  {room.friend.avatar_emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between">
                    <span className="font-medium">{room.friend.display_name}</span>
                    <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                      {room.lastMessage ? formatTime(room.lastMessage.created_at) : ""}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-black/50 dark:text-white/50">
                    {lastMessageLabel(room.lastMessage)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
