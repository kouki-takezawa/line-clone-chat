"use client";

import { useState } from "react";
import AdminHeader from "@/components/AdminHeader";

export default function BroadcastPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    const body = message.trim();
    if (!body) return;
    if (!window.confirm("全ユーザーのトークに配信します。よろしいですか？")) return;

    setSending(true);
    setResult(null);
    const res = await fetch("/api/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (res.ok) {
      setResult(`${data.sentCount}件のトークに配信しました`);
      setMessage("");
    } else {
      setResult(data.error || "配信に失敗しました");
    }
  }

  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto max-w-xl">
        <AdminHeader title="全体配信" back />
        <div className="space-y-4">
          <p className="text-sm text-white/50">
            全アカウントのトーク画面に「運営からのお知らせ」として一斉配信します。通常のメッセージと同じく24時間で自動削除されます。
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={1000}
            placeholder="配信内容を入力"
            className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 outline-none focus:border-white/50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="rounded-full bg-white px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            {sending ? "配信中..." : "配信する"}
          </button>
          {result && <p className="text-sm text-white/70">{result}</p>}
        </div>
      </div>
    </main>
  );
}
