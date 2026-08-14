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
  friendLastReadAt: string | null;
  unreadBoundary: string | null;
  onReact: (messageId: string, emoji: string) => void;
  onUnsend: (messageId: string) => void;
  onRetry: (message: PendingMessage) => void;
  onDismissFailed: (clientId: string) => void;
};

const NEAR_BOTTOM_THRESHOLD = 120;

function dateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateDivider(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
}

export default function MessageList({
  messages,
  reactions,
  currentUserId,
  ttlHours,
  friendLastReadAt,
  unreadBoundary,
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

  // Only the most recent own message the friend has read gets the "既読"
  // label, matching LINE — not every read message, which would just be
  // visual noise once several have been seen.
  let lastReadOwnIndex = -1;
  if (friendLastReadAt) {
    // Date comparison, not string comparison: created_at and
    // friendLastReadAt can arrive via different serialization paths (REST
    // vs. the realtime WAL stream vs. a client-side toISOString() call)
    // that don't always produce byte-identical ISO formats even for the
    // same instant (e.g. "Z" vs "+00:00", differing fractional digits).
    const readCutoff = new Date(friendLastReadAt).getTime();
    messages.forEach((m, i) => {
      if (m.sender_id === currentUserId && !m.status && new Date(m.created_at).getTime() <= readCutoff) {
        lastReadOwnIndex = i;
      }
    });
  }

  // First message from the friend that arrived after the viewer's own
  // last_read_at *at the moment the room was opened* gets a "ここから未読"
  // divider right before it.
  let firstUnreadIndex = -1;
  if (unreadBoundary) {
    const boundary = new Date(unreadBoundary).getTime();
    firstUnreadIndex = messages.findIndex(
      (m) => m.sender_id !== currentUserId && new Date(m.created_at).getTime() > boundary,
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full space-y-1 overflow-y-auto bg-neutral-100 p-4 dark:bg-neutral-900"
      >
        {messages.length === 0 && (
          <p className="mt-8 px-6 text-center text-sm text-black/40 dark:text-white/40">
            24時間が経過するとメッセージは自動的に削除されます。新しいメッセージを送ってみましょう！
          </p>
        )}
        {messages.map((message, i) => {
          const showDateDivider = i === 0 || dateKey(messages[i - 1].created_at) !== dateKey(message.created_at);
          const showSenderName = message.sender_id !== messages[i - 1]?.sender_id;
          return (
            <div key={message.id}>
              {showDateDivider && (
                <div className="my-3 text-center text-xs text-black/40 dark:text-white/40">
                  {formatDateDivider(message.created_at)}
                </div>
              )}
              {i === firstUnreadIndex && (
                <div className="my-3 flex items-center gap-2 text-xs text-black/40 dark:text-white/40">
                  <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                  ここから未読
                  <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                </div>
              )}
              <div className={showDateDivider || showSenderName ? "" : "mt-0.5"}>
                <MessageBubble
                  message={message}
                  isOwn={message.sender_id === currentUserId}
                  isRead={i === lastReadOwnIndex}
                  showSenderName={showSenderName}
                  reactions={reactions[message.id] ?? []}
                  currentUserId={currentUserId}
                  ttlHours={ttlHours}
                  now={now}
                  onReact={(emoji) => onReact(message.id, emoji)}
                  onUnsend={() => onUnsend(message.id)}
                  onRetry={() => onRetry(message)}
                  onDismissFailed={() => onDismissFailed(message.id)}
                />
              </div>
            </div>
          );
        })}
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
