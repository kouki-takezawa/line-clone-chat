"use client";

import { useEffect, useRef } from "react";
import type { MessageWithSender } from "@/lib/types";
import MessageBubble from "@/components/MessageBubble";

type Props = {
  messages: MessageWithSender[];
  currentUserId: string;
};

export default function MessageList({ messages, currentUserId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-neutral-100 p-4 dark:bg-neutral-900">
      {messages.length === 0 && (
        <p className="mt-8 text-center text-sm text-black/40 dark:text-white/40">
          まだメッセージはありません
        </p>
      )}
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={message.sender_id === currentUserId}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
