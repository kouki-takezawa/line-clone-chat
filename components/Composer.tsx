"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

const MAX_MESSAGE_LENGTH = 1000;

type Props = {
  onSendText: (text: string) => void;
  onSendImage: (file: File) => void;
  onTyping: () => void;
  error: string | null;
};

export default function Composer({ onSendText, onSendImage, onTyping, error }: Props) {
  const [body, setBody] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    onSendText(text);
    setBody("");
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onSendImage(file);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10"
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label="画像を送信"
        className="shrink-0 rounded-full border border-black/15 px-3 py-2 text-lg dark:border-white/20"
      >
        📷
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="text"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          onTyping();
        }}
        placeholder="メッセージを入力"
        maxLength={MAX_MESSAGE_LENGTH}
        className="flex-1 rounded-full border border-black/15 px-4 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
      />
      <button
        type="submit"
        disabled={!body.trim()}
        className="shrink-0 whitespace-nowrap rounded-full bg-[#06C755] px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        送信
      </button>
      {error && <p className="absolute -top-6 left-3 text-xs text-red-600">{error}</p>}
    </form>
  );
}
