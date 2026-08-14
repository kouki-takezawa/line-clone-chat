"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

const MAX_MESSAGE_LENGTH = 1000;

type Props = {
  onSendText: (text: string) => void;
  onSendImages: (files: File[]) => void;
  onTyping: () => void;
  error: string | null;
};

export default function Composer({ onSendText, onSendImages, onTyping, error }: Props) {
  const [body, setBody] = useState("");
  const [locating, setLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function submit() {
    const text = body.trim();
    if (!text) return;
    onSendText(text);
    setBody("");
    requestAnimationFrame(resizeTextarea);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    onSendImages(files);
  }

  function shareLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        onSendText(`現在地: https://www.google.com/maps?q=${latitude},${longitude}`);
      },
      () => setLocating(false),
      { timeout: 10000 },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-end gap-2 border-t border-black/10 p-3 dark:border-white/10"
    >
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        aria-label="画像を送信"
        className="shrink-0 rounded-full border border-black/15 px-3 py-2 text-lg dark:border-white/20"
      >
        📷
      </button>
      <button
        type="button"
        onClick={shareLocation}
        disabled={locating}
        aria-label="現在地を送信"
        className="shrink-0 rounded-full border border-black/15 px-3 py-2 text-lg disabled:opacity-50 dark:border-white/20"
      >
        📍
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <textarea
        ref={textareaRef}
        rows={1}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          onTyping();
          resizeTextarea();
        }}
        placeholder="メッセージを入力"
        maxLength={MAX_MESSAGE_LENGTH}
        className="max-h-[120px] flex-1 resize-none rounded-2xl border border-black/15 px-4 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
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
