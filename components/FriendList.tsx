"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyRoomMember } from "@/lib/roomMemberActions";
import type { RoomSummary } from "@/lib/types";
import SwipeableRow from "@/components/SwipeableRow";
import Avatar from "@/components/Avatar";
import BadgeSync from "@/components/BadgeSync";

type Props = {
  rooms: RoomSummary[];
  currentUserId: string;
};

function formatListTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "昨日";

  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function lastMessageLabel(message: RoomSummary["lastMessage"]) {
  if (!message) return "";
  if (message.body) return message.body;
  if (message.image_path) return "[画像]";
  return "";
}

function sortRooms(rooms: RoomSummary[]) {
  return [...rooms].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const at = a.lastMessage?.created_at ?? "";
    const bt = b.lastMessage?.created_at ?? "";
    return bt.localeCompare(at);
  });
}

export default function FriendList({ rooms: initialRooms, currentUserId }: Props) {
  const router = useRouter();
  const [rooms, setRooms] = useState(initialRooms);

  // SwipeableRow can't be a <Link> (it needs the whole row for pointer
  // gestures), which means it misses out on Link's automatic
  // viewport-based prefetch — so each room's chat page only started
  // loading after the tap, not before. Prefetching explicitly on mount
  // closes that gap and makes the transition feel instant.
  useEffect(() => {
    for (const room of rooms) {
      router.prefetch(`/chat/${room.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms.length]);

  async function togglePin(roomId: string, pinned: boolean) {
    setRooms((prev) => sortRooms(prev.map((r) => (r.id === roomId ? { ...r, pinned: !pinned } : r))));
    await updateMyRoomMember(roomId, currentUserId, { pinned: !pinned });
  }

  async function deleteTalk(roomId: string) {
    if (!window.confirm("このトークを削除しますか？(自分の画面からのみ削除され、相手には残ります)")) return;
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    await updateMyRoomMember(roomId, currentUserId, { talk_hidden: true });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BadgeSync unreadCount={rooms.reduce((sum, r) => sum + r.unreadCount, 0)} />
      <header className="border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <h1 className="text-lg font-semibold">トーク</h1>
      </header>

      {rooms.length === 0 ? (
        <p className="flex-1 p-6 text-center text-sm text-black/50 dark:text-white/50">
          トークがありません。ホームから友達を選んで話しかけてみましょう。
        </p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto pb-20 dark:divide-white/10">
          {rooms.map((room) => (
            <li key={room.id}>
              <SwipeableRow
                onTap={() => router.push(`/chat/${room.id}`)}
                actions={[
                  {
                    label: room.pinned ? "ピン解除" : "ピン止め",
                    onClick: () => togglePin(room.id, room.pinned),
                    className: "bg-amber-500",
                  },
                  {
                    label: "削除",
                    onClick: () => deleteTalk(room.id),
                    className: "bg-red-500",
                  },
                ]}
              >
                <div className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10">
                  <Avatar profile={room.friend} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1">
                      {room.pinned && <span className="text-xs">📌</span>}
                      {room.muted && <span className="text-xs">🔕</span>}
                      <span className="flex-1 truncate font-medium">{room.friend.display_name}</span>
                      <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                        {room.lastMessage ? formatListTime(room.lastMessage.created_at) : ""}
                      </span>
                    </span>
                    <span className="block truncate text-sm text-black/50 dark:text-white/50">
                      {lastMessageLabel(room.lastMessage)}
                    </span>
                  </span>
                  {room.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#06C755] px-1.5 text-xs font-medium text-white">
                      {room.unreadCount > 99 ? "99+" : room.unreadCount}
                    </span>
                  )}
                </div>
              </SwipeableRow>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
