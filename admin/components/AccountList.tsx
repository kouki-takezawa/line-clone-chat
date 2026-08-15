"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";

export type Account = {
  id: string;
  email: string;
  createdAt: string;
  bannedUntil: string | null;
  displayName: string;
  friendCode: string;
  roomCount: number;
  friendCount: number;
};

type SortKey = "displayName" | "email" | "createdAt" | "friendCount" | "roomCount";
type StatusFilter = "all" | "restricted" | "today";

function isBanned(a: Account): boolean {
  if (!a.bannedUntil) return false;
  return new Date(a.bannedUntil).getTime() > Date.now();
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function toCsv(accounts: Account[]): string {
  const header = ["表示名", "メール", "友達コード", "登録日", "友達数", "トーク数", "状態"];
  const rows = accounts.map((a) => [
    a.displayName,
    a.email,
    a.friendCode,
    new Date(a.createdAt).toISOString(),
    String(a.friendCount),
    String(a.roomCount),
    isBanned(a) ? "制限中" : "通常",
  ]);
  return [header, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function AccountList({ accounts: initial }: { accounts: Account[] }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [accounts, setAccounts] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState("");
  const [showBulkMessage, setShowBulkMessage] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = accounts;
    if (q) {
      rows = rows.filter(
        (a) => a.displayName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.friendCode.toLowerCase().includes(q),
      );
    }
    if (status === "restricted") rows = rows.filter(isBanned);
    if (status === "today") rows = rows.filter((a) => isToday(a.createdAt));

    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
      else if (sortKey === "friendCount") cmp = a.friendCount - b.friendCount;
      else if (sortKey === "roomCount") cmp = a.roomCount - b.roomCount;
      else cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortDesc ? -cmp : cmp;
    });
    return sorted;
  }, [accounts, query, status, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((v) => !v);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id))));
  }

  async function handleDelete(id: string, label: string) {
    const ok = await confirm({ title: `「${label}」を完全に削除します`, description: "元に戻せません。", danger: true });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/accounts/${id}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setBusy(false);
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast("削除しました");
    } else {
      toast("削除に失敗しました", "error");
    }
  }

  async function handleToggleRestrict(id: string, currentlyBanned: boolean) {
    setBusy(true);
    const res = await fetch(`/api/accounts/${id}/restrict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duration: currentlyBanned ? "none" : "876000h" }),
    });
    setBusy(false);
    if (res.ok) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, bannedUntil: !currentlyBanned ? new Date(Date.now() + 1e13).toISOString() : null } : a)),
      );
      toast(currentlyBanned ? "制限を解除しました" : "制限しました");
    } else {
      toast("操作に失敗しました", "error");
    }
  }

  async function handleBulkRestrict(restrict: boolean) {
    const ids = Array.from(selected);
    const ok = await confirm({
      title: restrict ? `${ids.length}件を制限しますか？` : `${ids.length}件の制限を解除しますか？`,
      danger: restrict,
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch("/api/accounts/bulk/restrict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, duration: restrict ? "876000h" : "none" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    toast(`${data.succeeded ?? 0}/${ids.length}件を処理しました`);
    setSelected(new Set());
    router.refresh();
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    const ok = await confirm({ title: `${ids.length}件を完全に削除します`, description: "元に戻せません。", danger: true });
    if (!ok) return;
    setBusy(true);
    const res = await fetch("/api/accounts/bulk/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setAccounts((prev) => prev.filter((a) => !selected.has(a.id)));
    toast(`${data.succeeded ?? 0}/${ids.length}件を削除しました`);
    setSelected(new Set());
  }

  async function handleBulkMessage() {
    const ids = Array.from(selected);
    if (!bulkMessage.trim()) return;
    setBusy(true);
    const res = await fetch("/api/accounts/bulk/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, message: bulkMessage.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    toast(`${data.succeeded ?? 0}/${ids.length}件に送信しました`);
    setBulkMessage("");
    setShowBulkMessage(false);
    setSelected(new Set());
  }

  function handleExportCsv() {
    const csv = "﻿" + toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const sortLabel: Record<SortKey, string> = {
    displayName: "表示名",
    email: "メール",
    createdAt: "登録日",
    friendCount: "友達数",
    roomCount: "トーク数",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="表示名・メール・友達コードで検索"
          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="rounded-lg border border-white/20 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-white/50"
        >
          <option value="all">すべて</option>
          <option value="restricted">制限中のみ</option>
          <option value="today">本日登録</option>
        </select>
        <button onClick={handleExportCsv} className="shrink-0 rounded-full border border-white/20 px-3 py-2 text-sm">
          CSV書き出し
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/20 bg-white/5 p-3">
          <span className="text-sm">選択中 {selected.size}件</span>
          <button onClick={() => handleBulkRestrict(true)} disabled={busy} className="rounded-full border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50">
            一括制限
          </button>
          <button onClick={() => handleBulkRestrict(false)} disabled={busy} className="rounded-full border border-white/20 px-3 py-1.5 text-xs disabled:opacity-50">
            一括制限解除
          </button>
          <button onClick={() => setShowBulkMessage((v) => !v)} className="rounded-full border border-white/20 px-3 py-1.5 text-xs">
            メッセージ送信
          </button>
          <button onClick={handleBulkDelete} disabled={busy} className="rounded-full border border-red-400/40 px-3 py-1.5 text-xs text-red-400 disabled:opacity-50">
            一括削除
          </button>
        </div>
      )}
      {showBulkMessage && (
        <div className="flex gap-2 rounded-lg border border-white/10 p-3">
          <textarea
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="選択したアカウントにBotから送信するメッセージ"
            className="flex-1 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-white/50"
          />
          <button onClick={handleBulkMessage} disabled={busy || !bulkMessage.trim()} className="shrink-0 self-start rounded-full border border-white/20 px-3 py-2 text-xs disabled:opacity-50">
            送信
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-white/50">該当するアカウントがありません</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs text-white/50">
              <tr>
                <th className="w-10 p-3">
                  <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll} />
                </th>
                {(["displayName", "email", "createdAt", "friendCount", "roomCount"] as SortKey[]).map((key) => (
                  <th key={key} className="cursor-pointer select-none whitespace-nowrap p-3" onClick={() => toggleSort(key)}>
                    {sortLabel[key]} {sortKey === key ? (sortDesc ? "▼" : "▲") : ""}
                  </th>
                ))}
                <th className="p-3">状態</th>
                <th className="p-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((a) => {
                const banned = isBanned(a);
                return (
                  <tr key={a.id} className="hover:bg-white/5">
                    <td className="p-3">
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} />
                    </td>
                    <td className="p-3">
                      <Link href={`/accounts/${a.id}`} className="hover:underline">
                        {a.displayName || "(表示名なし)"}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate p-3 text-white/60">{a.email}</td>
                    <td className="whitespace-nowrap p-3 text-white/60">{new Date(a.createdAt).toLocaleDateString("ja-JP")}</td>
                    <td className="p-3 text-white/60">{a.friendCount}</td>
                    <td className="p-3 text-white/60">{a.roomCount}</td>
                    <td className="p-3">{banned ? <span className="text-red-400">制限中</span> : <span className="text-white/30">通常</span>}</td>
                    <td className="whitespace-nowrap p-3">
                      <button onClick={() => handleToggleRestrict(a.id, banned)} disabled={busy} className="mr-2 rounded-full border border-white/20 px-3 py-1 text-xs disabled:opacity-50">
                        {banned ? "解除" : "制限"}
                      </button>
                      <button onClick={() => handleDelete(a.id, a.displayName || a.email)} disabled={busy} className="rounded-full border border-red-400/40 px-3 py-1 text-xs text-red-400 disabled:opacity-50">
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
