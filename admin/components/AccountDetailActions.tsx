"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_OPTIONS = [
  { value: "24h", label: "1日" },
  { value: "168h", label: "7日" },
  { value: "720h", label: "30日" },
  { value: "876000h", label: "無期限" },
];

export default function AccountDetailActions({
  userId,
  displayName: initialDisplayName,
  banned,
  banReason,
}: {
  userId: string;
  displayName: string;
  banned: boolean;
  banReason: string | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [duration, setDuration] = useState("24h");
  const [reason, setReason] = useState(banReason ?? "");
  const [dm, setDm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({})) };
  }

  async function handleRename() {
    if (!displayName.trim()) return;
    setBusy("rename");
    const { ok, data } = await post(`/api/accounts/${userId}/rename`, { displayName: displayName.trim() });
    setBusy(null);
    setNotice(ok ? "表示名を変更しました" : data.error || "変更に失敗しました");
    if (ok) router.refresh();
  }

  async function handleRestrict() {
    setBusy("restrict");
    const { ok, data } = await post(`/api/accounts/${userId}/restrict`, { duration, reason });
    setBusy(null);
    setNotice(ok ? "制限しました" : data.error || "操作に失敗しました");
    if (ok) router.refresh();
  }

  async function handleUnrestrict() {
    setBusy("unrestrict");
    const { ok, data } = await post(`/api/accounts/${userId}/restrict`, { duration: "none" });
    setBusy(null);
    setNotice(ok ? "制限を解除しました" : data.error || "操作に失敗しました");
    if (ok) router.refresh();
  }

  async function handleSendMessage() {
    if (!dm.trim()) return;
    setBusy("message");
    const { ok, data } = await post(`/api/accounts/${userId}/message`, { message: dm.trim() });
    setBusy(null);
    setNotice(ok ? "メッセージを送信しました" : data.error || "送信に失敗しました");
    if (ok) setDm("");
  }

  async function handleDelete() {
    if (!window.confirm(`「${initialDisplayName || userId}」を完全に削除します。元に戻せません。よろしいですか？`)) return;
    setBusy("delete");
    const { ok, data } = await post(`/api/accounts/${userId}/delete`, { label: initialDisplayName });
    setBusy(null);
    if (ok) {
      router.replace("/");
    } else {
      setNotice(data.error || "削除に失敗しました");
    }
  }

  return (
    <div className="space-y-6">
      {notice && <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">{notice}</p>}

      <section className="space-y-2 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-white/70">表示名の変更</h2>
        <div className="flex gap-2">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            className="flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
          />
          <button
            onClick={handleRename}
            disabled={busy === "rename"}
            className="shrink-0 rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
          >
            変更
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-white/70">アカウント制限</h2>
        {banned ? (
          <button
            onClick={handleUnrestrict}
            disabled={busy === "unrestrict"}
            className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
          >
            制限を解除する
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
                    duration === opt.value ? "border-white bg-white text-black" : "border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="duration"
                    value={opt.value}
                    checked={duration === opt.value}
                    onChange={() => setDuration(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="理由(任意、管理者のみ閲覧)"
              maxLength={300}
              className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
            />
            <button
              onClick={handleRestrict}
              disabled={busy === "restrict"}
              className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
            >
              制限する
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-white/70">個別メッセージ送信(お知らせBotから)</h2>
        <textarea
          value={dm}
          onChange={(e) => setDm(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="このユーザーだけにメッセージを送る"
          className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
        />
        <button
          onClick={handleSendMessage}
          disabled={busy === "message" || !dm.trim()}
          className="rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
        >
          送信
        </button>
      </section>

      <section className="rounded-xl border border-red-400/30 p-4">
        <h2 className="mb-2 text-sm font-medium text-red-400">危険な操作</h2>
        <button
          onClick={handleDelete}
          disabled={busy === "delete"}
          className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-400 disabled:opacity-50"
        >
          アカウントを完全に削除
        </button>
      </section>
    </div>
  );
}
