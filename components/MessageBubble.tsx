"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageReaction } from "@/lib/types";
import type { PendingMessage } from "@/components/ChatRoom";
import ImageLightbox from "@/components/ImageLightbox";

type Props = {
  message: PendingMessage;
  isOwn: boolean;
  reactions: MessageReaction[];
  currentUserId: string;
  ttlHours: number;
  now: number;
  onReact: (emoji: string) => void;
  onUnsend: () => void;
  onRetry: () => void;
  onDismissFailed: () => void;
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const LONG_PRESS_MS = 500;

function formatRemaining(ttlHours: number, createdAt: string, now: number): string {
  const deadline = new Date(createdAt).getTime() + ttlHours * 60 * 60 * 1000;
  const remainingMs = deadline - now;
  if (remainingMs <= 0) return "まもなく削除";
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  if (totalMinutes >= 60) return `残り${Math.floor(totalMinutes / 60)}時間`;
  return `残り${totalMinutes}分`;
}

function groupReactions(
  reactions: MessageReaction[],
  currentUserId: string,
): { emoji: string; count: number; mine: boolean }[] {
  const groups = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const g = groups.get(r.emoji) ?? { count: 0, mine: false };
    g.count += 1;
    if (r.user_id === currentUserId) g.mine = true;
    groups.set(r.emoji, g);
  }
  return [...groups.entries()].map(([emoji, g]) => ({ emoji, count: g.count, mine: g.mine }));
}

export default function MessageBubble({
  message,
  isOwn,
  reactions,
  currentUserId,
  ttlHours,
  now,
  onReact,
  onUnsend,
  onRetry,
  onDismissFailed,
}: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pending send's image_path is a local blob: URL, usable directly with
  // no round trip — only a confirmed message (a real Storage path) needs
  // the signed-URL fetch below.
  const isBlobImage = message.image_path?.startsWith("blob:") ?? false;
  const imageUrl = isBlobImage ? message.image_path : signedUrl;

  useEffect(() => {
    if (!message.image_path || isBlobImage) return;
    let cancelled = false;

    // 5-minute expiry (SECURITY_AND_CAPACITY.md): if a URL ever leaks, it's
    // only useful for a few minutes. Re-fetched fresh on every mount, so
    // the short lifetime doesn't affect normal viewing.
    const supabase = createClient();
    supabase.storage
      .from("chat-images")
      .createSignedUrl(message.image_path, 300)
      .then(({ data }) => {
        if (!cancelled && data) setSignedUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [message.image_path, isBlobImage]);

  const time = new Date(message.created_at).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function startPress() {
    pressTimer.current = setTimeout(() => setMenuOpen(true), LONG_PRESS_MS);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen(true);
  }

  async function copyText() {
    if (!message.body) return;
    await navigator.clipboard.writeText(message.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setMenuOpen(false);
  }

  const grouped = groupReactions(reactions, currentUserId);
  const isFailedImage = message.status === "failed" && message.image_path?.startsWith("blob:");
  const isRetryable = message.status === "failed" && !isFailedImage;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isOwn && (
          <span className="text-xs text-black/50 dark:text-white/50">
            {message.sender.avatar_emoji} {message.sender.display_name}
          </span>
        )}
        <div
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={handleContextMenu}
          className={`select-none rounded-2xl px-3 py-2 transition-opacity ${
            message.status === "pending" ? "opacity-50" : ""
          } ${
            isOwn
              ? "bg-[#06C755] text-white"
              : "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white"
          }`}
        >
          {message.image_path &&
            (imageUrl ? (
              <button type="button" onClick={() => setLightboxOpen(true)} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="送信された画像"
                  className="mb-1 max-h-64 rounded-lg object-contain"
                />
              </button>
            ) : (
              <div className="mb-1 flex h-32 w-48 items-center justify-center rounded-lg bg-black/10 text-xs dark:bg-white/10">
                読み込み中...
              </div>
            ))}
          {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        </div>

        {grouped.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {grouped.map((g) => (
              <button
                key={g.emoji}
                type="button"
                onClick={() => onReact(g.emoji)}
                className={`rounded-full border px-1.5 py-0.5 text-xs ${
                  g.mine
                    ? "border-[#06C755] bg-[#06C755]/10"
                    : "border-black/10 bg-white dark:border-white/20 dark:bg-neutral-800"
                }`}
              >
                {g.emoji} {g.count}
              </button>
            ))}
          </div>
        )}

        {message.status === "failed" ? (
          <div className="flex items-center gap-2 text-xs text-red-600">
            <span>{message.errorMessage ?? "送信に失敗しました"}</span>
            {isRetryable && (
              <button type="button" onClick={onRetry} className="underline">
                再試行
              </button>
            )}
            <button type="button" onClick={onDismissFailed} aria-label="取り消す" className="underline">
              削除
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-black/40 dark:text-white/40">
            {time}
            {message.status !== "pending" && ` · ${formatRemaining(ttlHours, message.created_at, now)}`}
          </span>
        )}
      </div>

      {lightboxOpen && imageUrl && (
        <ImageLightbox src={imageUrl} onClose={() => setLightboxOpen(false)} />
      )}

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/30"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 pb-6 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center gap-3">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onReact(emoji);
                    setMenuOpen(false);
                  }}
                  className="text-2xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
              {message.body && (
                <button
                  type="button"
                  onClick={copyText}
                  className="w-full py-3 text-center text-sm active:bg-black/5 dark:active:bg-white/10"
                >
                  {copied ? "コピーしました" : "コピー"}
                </button>
              )}
              {isOwn && message.status !== "pending" && (
                <button
                  type="button"
                  onClick={() => {
                    onUnsend();
                    setMenuOpen(false);
                  }}
                  className="w-full py-3 text-center text-sm text-red-600 active:bg-black/5 dark:active:bg-white/10"
                >
                  送信取消
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
