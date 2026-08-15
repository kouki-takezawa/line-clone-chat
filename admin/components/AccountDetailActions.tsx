"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

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
  friendRequestsRestricted: initialFriendRestricted,
  messagingRestricted: initialMessagingRestricted,
}: {
  userId: string;
  displayName: string;
  banned: boolean;
  banReason: string | null;
  friendRequestsRestricted: boolean;
  messagingRestricted: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [duration, setDuration] = useState("24h");
  const [reason, setReason] = useState(banReason ?? "");
  const [dm, setDm] = useState("");
  const [friendRestricted, setFriendRestricted] = useState(initialFriendRestricted);
  const [messagingRestricted, setMessagingRestricted] = useState(initialMessagingRestricted);
  const [busy, setBusy] = useState<string | null>(null);

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
    toast(ok ? "表示名を変更しました" : data.error || "変更に失敗しました", ok ? "info" : "error");
    if (ok) router.refresh();
  }

  async function handleRestrict() {
    setBusy("restrict");
    const { ok, data } = await post(`/api/accounts/${userId}/restrict`, { duration, reason });
    setBusy(null);
    toast(ok ? "制限しました" : data.error || "操作に失敗しました", ok ? "info" : "error");
    if (ok) router.refresh();
  }

  async function handleUnrestrict() {
    setBusy("unrestrict");
    const { ok, data } = await post(`/api/accounts/${userId}/restrict`, { duration: "none" });
    setBusy(null);
    toast(ok ? "制限を解除しました" : data.error || "操作に失敗しました", ok ? "info" : "error");
    if (ok) router.refresh();
  }

  async function handleSendMessage() {
    if (!dm.trim()) return;
    setBusy("message");
    const { ok, data } = await post(`/api/accounts/${userId}/message`, { message: dm.trim() });
    setBusy(null);
    toast(ok ? "メッセージを送信しました" : data.error || "送信に失敗しました", ok ? "info" : "error");
    if (ok) setDm("");
  }

  async function handleToggleFriendRestrict() {
    const next = !friendRestricted;
    setBusy("friends");
    const { ok, data } = await post(`/api/accounts/${userId}/restrict-friends`, { restrict: next });
    setBusy(null);
    if (ok) {
      setFriendRestricted(next);
      toast(next ? "友達追加を制限しました" : "友達追加の制限を解除しました");
    } else {
      toast(data.error || "操作に失敗しました", "error");
    }
  }

  async function handleToggleMessagingRestrict() {
    const next = !messagingRestricted;
    setBusy("messaging");
    const { ok, data } = await post(`/api/accounts/${userId}/restrict-messaging`, { restrict: next });
    setBusy(null);
    if (ok) {
      setMessagingRestricted(next);
      toast(next ? "トーク送信を制限しました" : "トーク送信の制限を解除しました");
    } else {
      toast(data.error || "操作に失敗しました", "error");
    }
  }

  async function handleDelete() {
    const ok0 = await confirm({
      title: `「${initialDisplayName || userId}」を完全に削除します`,
      description: "元に戻せません。よろしいですか？",
      danger: true,
    });
    if (!ok0) return;
    setBusy("delete");
    const { ok, data } = await post(`/api/accounts/${userId}/delete`, { label: initialDisplayName });
    setBusy(null);
    if (ok) {
      router.replace("/");
    } else {
      toast(data.error || "削除に失敗しました", "error");
    }
  }

  return (
    <div className="space-y-6">

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

      <section className="space-y-3 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-white/70">個別の利用制限(アカウント自体はログイン可能なまま)</h2>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">友達追加を制限</p>
            <p className="text-xs text-white/40">友達申請の送信・承認ができなくなります</p>
          </div>
          <button
            onClick={handleToggleFriendRestrict}
            disabled={busy === "friends"}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs disabled:opacity-50 ${
              friendRestricted ? "border-red-400/40 bg-red-500/20 text-red-300" : "border-white/20"
            }`}
          >
            {friendRestricted ? "制限中" : "制限する"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">トーク送信を制限</p>
            <p className="text-xs text-white/40">トーク画面は開けますが、メッセージの送信ができなくなります</p>
          </div>
          <button
            onClick={handleToggleMessagingRestrict}
            disabled={busy === "messaging"}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs disabled:opacity-50 ${
              messagingRestricted ? "border-red-400/40 bg-red-500/20 text-red-300" : "border-white/20"
            }`}
          >
            {messagingRestricted ? "制限中" : "制限する"}
          </button>
        </div>
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
