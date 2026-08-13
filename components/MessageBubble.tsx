"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageWithSender } from "@/lib/types";

type Props = {
  message: MessageWithSender;
  isOwn: boolean;
};

export default function MessageBubble({ message, isOwn }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message.image_path) return;
    let cancelled = false;

    const supabase = createClient();
    supabase.storage
      .from("chat-images")
      .createSignedUrl(message.image_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setImageUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [message.image_path]);

  const time = new Date(message.created_at).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!isOwn && (
          <span className="text-xs text-black/50 dark:text-white/50">
            {message.sender.avatar_emoji} {message.sender.display_name}
          </span>
        )}
        <div
          className={`rounded-2xl px-3 py-2 ${
            isOwn
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-black/5 dark:bg-white/10"
          }`}
        >
          {message.image_path && (
            imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="送信された画像"
                className="mb-1 max-h-64 rounded-lg object-contain"
              />
            ) : (
              <div className="mb-1 flex h-32 w-48 items-center justify-center rounded-lg bg-black/10 text-xs dark:bg-white/10">
                読み込み中...
              </div>
            )
          )}
          {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        </div>
        <span className="text-[10px] text-black/40 dark:text-white/40">{time}</span>
      </div>
    </div>
  );
}
