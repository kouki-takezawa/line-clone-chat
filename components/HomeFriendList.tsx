"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateMyRoomMember } from "@/lib/roomMemberActions";
import Avatar from "@/components/Avatar";
import SwipeableRow from "@/components/SwipeableRow";
import type { Profile } from "@/lib/types";

type Props = {
  me: Profile;
  friends: { roomId: string; friend: Profile }[];
  pendingRequestCount: number;
};

export default function HomeFriendList({ me, friends: initialFriends, pendingRequestCount }: Props) {
  const router = useRouter();
  const [friends, setFriends] = useState(initialFriends);
  const [query, setQuery] = useState("");

  // See FriendList.tsx for why this is needed: SwipeableRow can't be a
  // <Link>, so it misses Link's automatic prefetch.
  useEffect(() => {
    router.prefetch("/home/me");
    for (const { friend } of friends) {
      router.prefetch(`/home/friend/${friend.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends.length]);

  async function removeFriend(roomId: string, friendId: string) {
    if (!window.confirm("この友達を削除しますか？(自分の一覧からのみ削除されます)")) return;
    setFriends((prev) => prev.filter((f) => f.friend.id !== friendId));
    await updateMyRoomMember(roomId, me.id, { friend_removed: true });
  }

  async function blockFriend(roomId: string, friendId: string) {
    if (!window.confirm("この友達をブロックしますか？お互いにメッセージが送れなくなります。")) return;
    setFriends((prev) => prev.filter((f) => f.friend.id !== friendId));
    const supabase = createClient();
    await Promise.all([
      supabase.from("blocks").insert({ blocker_id: me.id, blocked_id: friendId }),
      updateMyRoomMember(roomId, me.id, { friend_removed: true, talk_hidden: true }),
    ]);
  }

  const visibleFriends = query.trim()
    ? friends.filter(({ friend }) => friend.display_name.toLowerCase().includes(query.trim().toLowerCase()))
    : friends;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <h1 className="text-lg font-semibold">友達一覧</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/home/requests" className="relative text-black/60 dark:text-white/60">
            届いている申請
            {pendingRequestCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {pendingRequestCount}
              </span>
            )}
          </Link>
          <Link
            href="/home/add"
            className="rounded-full bg-[#06C755] px-3 py-1.5 font-medium text-white"
          >
            ＋追加
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20">
        {/* Own profile preview — editing still lives in 設定, reached from there. */}
        <Link
          href="/home/me"
          className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left active:bg-black/5 dark:border-white/10 dark:active:bg-white/10"
        >
          <Avatar profile={me} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{me.display_name}</span>
            <span className="block text-xs text-black/40 dark:text-white/40">自分のプロフィール</span>
          </span>
        </Link>

        {friends.length > 0 && (
          <div className="border-b border-black/5 px-4 py-2 dark:border-white/10">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="友達を検索"
              className="w-full rounded-full border border-black/15 px-3 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-neutral-900 dark:focus:border-white/50"
            />
          </div>
        )}

        {friends.length === 0 ? (
          <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">
            まだ友達が追加されていません。「＋追加」からIDまたはQRコードで友達を探せます。
          </p>
        ) : visibleFriends.length === 0 ? (
          <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">
            「{query}」に一致する友達が見つかりません。
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {visibleFriends.map(({ roomId, friend }) => {
              const rowContent = (
                <div className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10">
                  <Avatar profile={friend} />
                  <span className="font-medium">{friend.display_name}</span>
                </div>
              );

              // The announcements bot can't be removed or blocked, so it
              // gets no swipe actions at all.
              if (friend.is_system_bot) {
                return (
                  <li key={friend.id}>
                    <button type="button" onClick={() => router.push(`/home/friend/${friend.id}`)} className="block w-full">
                      {rowContent}
                    </button>
                  </li>
                );
              }

              return (
                <li key={friend.id}>
                  <SwipeableRow
                    onTap={() => router.push(`/home/friend/${friend.id}`)}
                    actions={[
                      {
                        label: "削除",
                        onClick: () => removeFriend(roomId, friend.id),
                        className: "bg-neutral-500",
                      },
                      {
                        label: "ブロック",
                        onClick: () => blockFriend(roomId, friend.id),
                        className: "bg-red-500",
                      },
                    ]}
                  >
                    {rowContent}
                  </SwipeableRow>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
