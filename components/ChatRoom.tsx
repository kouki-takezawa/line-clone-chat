"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Message, MessageWithSender, Profile } from "@/lib/types";
import { avatarColorFor } from "@/lib/avatarColor";
import MessageList from "@/components/MessageList";
import Composer from "@/components/Composer";

type Props = {
  roomId: string;
  currentUserId: string;
  friend: Profile;
  initialMessages: MessageWithSender[];
  members: Profile[];
};

export default function ChatRoom({
  roomId,
  currentUserId,
  friend,
  initialMessages,
  members,
}: Props) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const membersRef = useRef(members);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as Message;
          const sender = membersRef.current.find((m) => m.id === row.sender_id);
          if (!sender) return;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, sender }],
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const oldRow = payload.old as Partial<Message>;
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 bg-[#06C755] px-2 py-3 text-white">
        <Link
          href="/chat"
          aria-label="トーク一覧に戻る"
          className="rounded-full p-2 text-xl leading-none active:bg-white/15"
        >
          ←
        </Link>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${avatarColorFor(friend.id)}`}
        >
          {friend.avatar_emoji}
        </span>
        <h1 className="truncate text-base font-semibold">{friend.display_name}</h1>
      </header>

      <MessageList messages={messages} currentUserId={currentUserId} />

      <p className="bg-white px-3 pt-1 text-center text-[11px] text-black/35 dark:bg-neutral-950 dark:text-white/35">
        メッセージは送信から24時間で自動的に削除されます
      </p>

      <Composer roomId={roomId} currentUserId={currentUserId} />
    </div>
  );
}
