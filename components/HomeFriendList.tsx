"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { avatarColorFor } from "@/lib/avatarColor";
import type { Profile } from "@/lib/types";

type Props = {
  me: Profile;
  friends: { roomId: string; friend: Profile }[];
};

export default function HomeFriendList({ me, friends }: Props) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(me.display_name);
  const [avatarEmoji, setAvatarEmoji] = useState(me.avatar_emoji);
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || me.display_name,
        avatar_emoji: avatarEmoji.trim() || me.avatar_emoji,
      })
      .eq("id", me.id);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <h1 className="text-lg font-semibold">友達一覧</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20">
        {/* Your own account — tap to edit how your name/icon appear to others. */}
        <div className="border-b border-black/5 dark:border-white/10">
          {editing ? (
            <div className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={avatarEmoji}
                  onChange={(e) => setAvatarEmoji(e.target.value)}
                  maxLength={4}
                  className="h-12 w-12 shrink-0 rounded-full border border-black/15 text-center text-2xl dark:border-white/20 dark:bg-neutral-900"
                />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="表示名"
                  className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="rounded-full bg-[#06C755] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setDisplayName(me.display_name);
                    setAvatarEmoji(me.avatar_emoji);
                  }}
                  className="rounded-full border border-black/15 px-4 py-1.5 text-sm dark:border-white/20"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${avatarColorFor(me.id)}`}
              >
                {me.avatar_emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{me.display_name}</span>
                <span className="block text-xs text-black/40 dark:text-white/40">
                  タップしてプロフィールを編集
                </span>
              </span>
            </button>
          )}
        </div>

        {friends.length === 0 ? (
          <p className="p-6 text-center text-sm text-black/50 dark:text-white/50">
            まだ友達が追加されていません。
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {friends.map(({ roomId, friend }) => (
              <li key={friend.id}>
                <Link
                  href={`/chat/${roomId}`}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${avatarColorFor(friend.id)}`}
                  >
                    {friend.avatar_emoji}
                  </span>
                  <span className="font-medium">{friend.display_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
