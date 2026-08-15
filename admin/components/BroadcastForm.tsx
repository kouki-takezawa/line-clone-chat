"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

export type ScheduledBroadcast = {
  id: string;
  message: string;
  scheduledAt: string;
};

export default function BroadcastForm({ scheduled }: { scheduled: ScheduledBroadcast[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduling, setScheduling] = useState(false);

  async function handleSend() {
    const body = message.trim();
    if (!body) return;
    const ok = await confirm({ title: "全ユーザーのトークに配信します", description: "よろしいですか？" });
    if (!ok) return;

    setSending(true);
    const res = await fetch("/api/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (res.ok) {
      toast(`${data.sentCount}件のトークに配信しました`);
      setMessage("");
    } else {
      toast(data.error || "配信に失敗しました", "error");
    }
  }

  async function handleSchedule() {
    const body = scheduleMessage.trim();
    if (!body || !scheduleAt) return;
    setScheduling(true);
    const res = await fetch("/api/broadcast/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: body, scheduledAt: new Date(scheduleAt).toISOString() }),
    });
    const data = await res.json().catch(() => ({}));
    setScheduling(false);

    if (res.ok) {
      toast("配信を予約しました");
      setScheduleMessage("");
      setScheduleAt("");
      router.refresh();
    } else {
      toast(data.error || "予約に失敗しました", "error");
    }
  }

  async function handleCancel(id: string) {
    const ok = await confirm({ title: "予約をキャンセルしますか？" });
    if (!ok) return;
    const res = await fetch(`/api/broadcast/schedule/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("キャンセルしました");
      router.refresh();
    } else {
      toast("キャンセルに失敗しました", "error");
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
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
          {sending ? "配信中..." : "今すぐ配信する"}
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-white/70">予約配信</h2>
        <textarea
          value={scheduleMessage}
          onChange={(e) => setScheduleMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="配信内容を入力"
          className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
          />
          <button
            onClick={handleSchedule}
            disabled={scheduling || !scheduleMessage.trim() || !scheduleAt}
            className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
          >
            予約する
          </button>
        </div>

        {scheduled.length > 0 && (
          <ul className="mt-3 divide-y divide-white/10 border-t border-white/10 pt-3">
            {scheduled.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-white/40">{new Date(s.scheduledAt).toLocaleString("ja-JP")}</p>
                  <p className="truncate">{s.message}</p>
                </div>
                <button
                  onClick={() => handleCancel(s.id)}
                  className="shrink-0 rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-400"
                >
                  キャンセル
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
