"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type Account = {
  id: string;
  email: string;
  createdAt: string;
  bannedUntil: string | null;
  displayName: string;
  friendCode: string;
};

function isBanned(a: Account): boolean {
  if (!a.bannedUntil) return false;
  return new Date(a.bannedUntil).getTime() > Date.now();
}

export default function AccountList({ accounts: initial }: { accounts: Account[] }) {
  const [accounts, setAccounts] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.displayName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.friendCode.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`「${label}」を完全に削除します。元に戻せません。よろしいですか？`)) return;
    setBusyId(id);
    const res = await fetch(`/api/accounts/${id}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setBusyId(null);
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } else {
      window.alert("削除に失敗しました");
    }
  }

  async function handleToggleRestrict(id: string, currentlyBanned: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/accounts/${id}/restrict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: currentlyBanned ? "none" : "876000h" }),
    });
    setBusyId(null);
    if (res.ok) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, bannedUntil: !currentlyBanned ? new Date(Date.now() + 1e13).toISOString() : null }
            : a,
        ),
      );
    } else {
      window.alert("操作に失敗しました");
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="表示名・メール・友達コードで検索"
        className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-white/50">該当するアカウントがありません</p>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {filtered.map((a) => {
            const banned = isBanned(a);
            return (
              <li key={a.id} className="flex items-center gap-3 p-4">
                <Link href={`/accounts/${a.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium hover:underline">{a.displayName || "(表示名なし)"}</p>
                  <p className="truncate text-xs text-white/50">{a.email}</p>
                  <p className="text-xs text-white/30">
                    登録: {new Date(a.createdAt).toLocaleDateString("ja-JP")} ・ ID: {a.friendCode}
                    {banned && <span className="ml-2 text-red-400">制限中</span>}
                  </p>
                </Link>
                <button
                  onClick={() => handleToggleRestrict(a.id, banned)}
                  disabled={busyId === a.id}
                  className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {banned ? "制限解除" : "制限する"}
                </button>
                <button
                  onClick={() => handleDelete(a.id, a.displayName || a.email)}
                  disabled={busyId === a.id}
                  className="shrink-0 rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50"
                >
                  削除
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
