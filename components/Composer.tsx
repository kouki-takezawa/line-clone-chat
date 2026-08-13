"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, getImageDimensions } from "@/lib/image";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB, before compression

type Props = {
  roomId: string;
  currentUserId: string;
};

function describeError(error: { message: string }, fallback: string): string {
  if (error.message.includes("rate limit")) {
    return error.message.includes("image")
      ? "画像の送信が多すぎます。しばらく待ってから送信してください"
      : "送信が速すぎます。少し待ってから送信してください";
  }
  if (error.message.includes("messages_body_length")) {
    return `メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください`;
  }
  return fallback;
}

export default function Composer({ roomId, currentUserId }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function sendText(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("messages")
      .insert({ room_id: roomId, sender_id: currentUserId, body: text });

    setSending(false);
    if (error) {
      setError(describeError(error, "送信に失敗しました"));
      return;
    }
    setBody("");
  }

  async function sendImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || sending) return;

    if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
      setError("画像が大きすぎます（20MB以下にしてください）");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const compressed = await compressImage(file);
      const { width, height } = await getImageDimensions(compressed);

      const supabase = createClient();
      const messageId = crypto.randomUUID();
      const path = `${roomId}/${messageId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(path, compressed, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("messages").insert({
        id: messageId,
        room_id: roomId,
        sender_id: currentUserId,
        image_path: path,
        image_width: width,
        image_height: height,
      });
      if (insertError) throw insertError;
    } catch (err) {
      setError(
        err instanceof Error ? describeError(err, "画像の送信に失敗しました") : "画像の送信に失敗しました",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={sendText}
      className="relative flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10"
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={sending}
        aria-label="画像を送信"
        className="shrink-0 rounded-full border border-black/15 px-3 py-2 text-lg disabled:opacity-50 dark:border-white/20"
      >
        📷
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={sendImage}
        className="hidden"
      />
      <input
        type="text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="メッセージを入力"
        disabled={sending}
        maxLength={MAX_MESSAGE_LENGTH}
        className="flex-1 rounded-full border border-black/15 px-4 py-2 outline-none focus:border-black/40 disabled:opacity-50 dark:border-white/20 dark:focus:border-white/50"
      />
      <button
        type="submit"
        disabled={sending || !body.trim()}
        className="shrink-0 whitespace-nowrap rounded-full bg-[#06C755] px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        送信
      </button>
      {error && <p className="absolute -top-6 left-3 text-xs text-red-600">{error}</p>}
    </form>
  );
}
