import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { Profile } from "@/lib/types";

type Props = {
  me: Profile;
  friends: { roomId: string; friend: Profile }[];
};

export default function HomeFriendList({ me, friends }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <h1 className="text-lg font-semibold">友達一覧</h1>
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
                  <Avatar profile={friend} />
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
