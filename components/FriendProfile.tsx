"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import type { Profile } from "@/lib/types";

type Props = {
  friend: Profile;
  roomId: string;
  currentUserId: string;
};

export default function FriendProfile({ friend, roomId, currentUserId }: Props) {
  const router = useRouter();
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", currentUserId)
      .eq("blocked_id", friend.id)
      .maybeSingle()
      .then(({ data }) => setBlocked(!!data));
  }, [currentUserId, friend.id]);

  async function removeFriend() {
    if (!window.confirm("この友達を削除しますか？(自分の一覧からのみ削除されます)")) return;
    const supabase = createClient();
    await supabase
      .from("room_members")
      .update({ friend_removed: true })
      .eq("room_id", roomId)
      .eq("user_id", currentUserId);
    router.push("/home");
  }

  async function toggleBlock() {
    const supabase = createClient();
    if (blocked) {
      if (!window.confirm("ブロックを解除しますか？")) return;
      await supabase.from("blocks").delete().eq("blocker_id", currentUserId).eq("blocked_id", friend.id);
      setBlocked(false);
      return;
    }
    if (!window.confirm("この友達をブロックしますか？お互いにメッセージが送れなくなります。")) return;
    await Promise.all([
      supabase.from("blocks").insert({ blocker_id: currentUserId, blocked_id: friend.id }),
      supabase
        .from("room_members")
        .update({ friend_removed: true, talk_hidden: true })
        .eq("room_id", roomId)
        .eq("user_id", currentUserId),
    ]);
    router.push("/home");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <Link href="/home" aria-label="友達一覧に戻る" className="text-lg">
          ←
        </Link>
        <h1 className="text-lg font-semibold">プロフィール</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center gap-3">
          <Avatar profile={friend} size="h-24 w-24" />
          <p className="text-xl font-semibold">{friend.display_name}</p>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          {!blocked && (
            <Link
              href={`/chat/${roomId}`}
              className="block w-full rounded-full bg-[#06C755] px-4 py-2 text-center text-sm font-medium text-white"
            >
              トークを開く
            </Link>
          )}
          <button
            type="button"
            onClick={removeFriend}
            className="w-full rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20"
          >
            友達を削除
          </button>
          <button
            type="button"
            onClick={toggleBlock}
            disabled={blocked === null}
            className="w-full rounded-full border border-red-200 px-4 py-2 text-sm text-red-600 disabled:opacity-50 dark:border-red-900"
          >
            {blocked ? "ブロックを解除" : "ブロックする"}
          </button>
        </div>
      </div>
    </div>
  );
}
