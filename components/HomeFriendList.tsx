import Link from "next/link";
import { avatarColorFor } from "@/lib/avatarColor";
import type { Profile } from "@/lib/types";

type Props = {
  friends: { roomId: string; friend: Profile }[];
};

export default function HomeFriendList({ friends }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-[#06C755] px-4 py-3 text-white">
        <h1 className="text-lg font-semibold">ホーム</h1>
      </header>

      {friends.length === 0 ? (
        <p className="flex-1 p-6 text-center text-sm text-black/50 dark:text-white/50">
          まだ友達が追加されていません。
        </p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto dark:divide-white/10">
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
  );
}
