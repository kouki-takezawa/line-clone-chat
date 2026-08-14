"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

  async function removeFriend(roomId: string, friendId: string) {
    setFriends((prev) => prev.filter((f) => f.friend.id !== friendId));
    const supabase = createClient();
    await supabase
      .from("room_members")
      .update({ friend_removed: true })
      .eq("room_id", roomId)
      .eq("user_id", me.id);
  }

  async function blockFriend(roomId: string, friendId: string) {
    setFriends((prev) => prev.filter((f) => f.friend.id !== friendId));
    const supabase = createClient();
    await Promise.all([
      supabase.from("blocks").insert({ blocker_id: me.id, blocked_id: friendId }),
      supabase
        .from("room_members")
        .update({ friend_removed: true, talk_hidden: true })
        .eq("room_id", roomId)
        .eq("user_id", me.id),
    ]);
  }

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
        {/* Your own account. Profile editing lives in 設定 now. */}
        <Link
          href="/settings"
          className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left active:bg-black/5 dark:border-white/10 dark:active:bg-white/10"
        >
          <Avatar profile={me} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{me.display_name}</span>
            <span className="block text-xs text-black/40 dark:text-white/40">自分のプロフィール</span>
          </span>
        </Link>

        {friends.length === 0 ? (
          <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">
            まだ友達が追加されていません。「＋追加」からIDまたはQRコードで友達を探せます。
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {friends.map(({ roomId, friend }) => (
              <li key={friend.id}>
                <SwipeableRow
                  onTap={() => router.push(`/chat/${roomId}`)}
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
                  <div className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10">
                    <Avatar profile={friend} />
                    <span className="font-medium">{friend.display_name}</span>
                  </div>
                </SwipeableRow>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
