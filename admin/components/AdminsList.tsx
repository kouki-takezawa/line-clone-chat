"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

export type AdminUser = {
  id: string;
  username: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export default function AdminsList({ admins, currentUsername }: { admins: AdminUser[]; currentUsername: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!username.trim() || password.length < 8) {
      toast("ユーザー名とパスワード(8文字以上)を入力してください", "error");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      toast("管理者を追加しました");
      setUsername("");
      setPassword("");
      router.refresh();
    } else {
      toast(data.error || "追加に失敗しました", "error");
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({ title: `「${name}」を削除しますか？`, danger: true });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admins/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      toast("削除しました");
      router.refresh();
    } else {
      toast(data.error || "削除に失敗しました", "error");
    }
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
        {admins.map((a) => (
          <li key={a.id} className="flex items-center gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {a.username}
                {a.username === currentUsername && <span className="ml-2 text-xs text-white/40">(あなた)</span>}
              </p>
              <p className="text-xs text-white/40">
                作成: {new Date(a.createdAt).toLocaleDateString("ja-JP")} ・ 最終ログイン:{" "}
                {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("ja-JP") : "-"}
              </p>
            </div>
            <button
              onClick={() => handleDelete(a.id, a.username)}
              disabled={busy}
              className="shrink-0 rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
            >
              削除
            </button>
          </li>
        ))}
      </ul>

      <section className="space-y-2 rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-medium text-white/70">管理者を追加</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ユーザー名"
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード(8文字以上)"
            className="min-w-0 flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
          />
          <button
            onClick={handleCreate}
            disabled={busy}
            className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </section>
    </div>
  );
}
