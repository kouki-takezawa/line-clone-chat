"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageReaction } from "@/lib/types";
import type { PendingMessage } from "@/components/ChatRoom";
import MessageBubble from "@/components/MessageBubble";

type Props = {
  messages: PendingMessage[];
  reactions: Record<string, MessageReaction[]>;
  currentUserId: string;
  ttlHours: number;
  onReact: (messageId: string, emoji: string) => void;
  onUnsend: (messageId: string) => void;
  onRetry: (message: PendingMessage) => void;
  onDismissFailed: (clientId: string) => void;
};

const NEAR_BOTTOM_THRESHOLD = 120;

export default function MessageList({
  messages,
  reactions,
  currentUserId,
  ttlHours,
  onReact,
  onUnsend,
  onRetry,
  onDismissFailed,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  // Ticks once a minute so every bubble's "remaining time" text re-renders
  // without each one running its own interval.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showScrollButton) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, showScrollButton]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom > NEAR_BOTTOM_THRESHOLD);
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full space-y-2 overflow-y-auto bg-neutral-100 p-4 dark:bg-neutral-900"
      >
        {messages.length === 0 && (
          <p className="mt-8 px-6 text-center text-sm text-black/40 dark:text-white/40">
            24時間が経過するとメッセージは自動的に削除されます。新しいメッセージを送ってみましょう！
          </p>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === currentUserId}
            reactions={reactions[message.id] ?? []}
            currentUserId={currentUserId}
            ttlHours={ttlHours}
            now={now}
            onReact={(emoji) => onReact(message.id, emoji)}
            onUnsend={() => onUnsend(message.id)}
            onRetry={() => onRetry(message)}
            onDismissFailed={() => onDismissFailed(message.id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {showScrollButton && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="最新のメッセージへ移動"
          className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-md dark:bg-neutral-800"
        >
          ↓
        </button>
      )}
    </div>
  );
}
