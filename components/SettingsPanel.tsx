"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserRow = {
  id: string;
  display_name: string;
  login_id: string | null;
  avatar_emoji: string;
  is_admin: boolean;
};

type Draft = { loginId: string; password: string; displayName: string };

const emptyDraft: Draft = { loginId: "", password: "", displayName: "" };
const MAX_FRIENDS = 5;

export default function SettingsPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selfDraft, setSelfDraft] = useState<Draft>(emptyDraft);
  const [selfSaving, setSelfSaving] = useState(false);
  const [selfSaved, setSelfSaved] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "読み込みに失敗しました");
      return;
    }
    setUsers(body.users);
    const self = (body.users as UserRow[]).find((u) => u.id === currentUserId);
    if (self) {
      setSelfDraft({ loginId: self.login_id ?? "", password: "", displayName: self.display_name });
    }
  }

  useEffect(() => {
    // loadUsers is also reused imperatively after mutations (save/add/delete),
    // so it can't be inlined as a plain fetch-then-setState effect body, and
    // is intentionally omitted from deps since it's stable across renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSelf(e: React.FormEvent) {
    e.preventDefault();
    setSelfSaving(true);
    setError(null);
    setSelfSaved(false);

    const payload: Record<string, string> = {
      loginId: selfDraft.loginId,
      displayName: selfDraft.displayName,
    };
    if (selfDraft.password) payload.password = selfDraft.password;

    const res = await fetch(`/api/admin/users/${currentUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setSelfSaving(false);

    if (!res.ok) {
      setError(body.error ?? "更新に失敗しました");
      return;
    }
    setSelfDraft((d) => ({ ...d, password: "" }));
    setSelfSaved(true);
    loadUsers();
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditDraft({ loginId: user.login_id ?? "", password: "", displayName: user.display_name });
    setError(null);
  }

  async function saveEdit(id: string) {
    setRowBusy(id);
    setError(null);
    const payload: Record<string, string> = {
      loginId: editDraft.loginId,
      displayName: editDraft.displayName,
    };
    if (editDraft.password) payload.password = editDraft.password;

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    setRowBusy(null);

    if (!res.ok) {
      setError(body.error ?? "更新に失敗しました");
      return;
    }
    setEditingId(null);
    loadUsers();
  }

  async function removeFriend(id: string) {
    if (!confirm("この友達のアカウントとトーク履歴を削除します。よろしいですか？")) return;
    setRowBusy(id);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const body = await res.json();
    setRowBusy(null);
    if (!res.ok) {
      setError(body.error ?? "削除に失敗しました");
      return;
    }
    loadUsers();
  }

  async function addFriend(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addDraft),
    });
    const body = await res.json();
    setAdding(false);
    if (!res.ok) {
      setError(body.error ?? "追加に失敗しました");
      return;
    }
    setAddDraft(emptyDraft);
    loadUsers();
  }

  const friends = (users ?? []).filter((u) => u.id !== currentUserId);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 bg-[#06C755] px-2 py-3 text-white">
        <Link
          href="/chat"
          aria-label="トーク一覧に戻る"
          className="rounded-full p-2 text-xl leading-none active:bg-white/15"
        >
          ←
        </Link>
        <h1 className="text-base font-semibold">設定</h1>
      </header>

      <div className="flex-1 space-y-8 overflow-y-auto p-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">自分のログイン情報</h2>
          <form onSubmit={saveSelf} className="space-y-2">
            <input
              type="text"
              value={selfDraft.displayName}
              onChange={(e) => setSelfDraft((d) => ({ ...d, displayName: e.target.value }))}
              placeholder="表示名"
              className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
            />
            <input
              type="text"
              value={selfDraft.loginId}
              onChange={(e) => setSelfDraft((d) => ({ ...d, loginId: e.target.value }))}
              placeholder="ログインID（半角英数字4〜32文字）"
              className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
            />
            <input
              type="password"
              value={selfDraft.password}
              onChange={(e) => setSelfDraft((d) => ({ ...d, password: e.target.value }))}
              placeholder="新しいパスワード（変更する場合のみ、6文字以上）"
              className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
            />
            <button
              type="submit"
              disabled={selfSaving}
              className="rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {selfSaving ? "保存中..." : "保存"}
            </button>
            {selfSaved && <span className="ml-2 text-sm text-black/50 dark:text-white/50">保存しました</span>}
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            友達を追加 <span className="font-normal text-black/40 dark:text-white/40">({friends.length}/{MAX_FRIENDS})</span>
          </h2>
          {friends.length >= MAX_FRIENDS ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              友達は最大{MAX_FRIENDS}人まで追加できます。追加するには、いずれかの友達を削除してください。
            </p>
          ) : (
            <form onSubmit={addFriend} className="space-y-2">
              <input
                type="text"
                value={addDraft.displayName}
                onChange={(e) => setAddDraft((d) => ({ ...d, displayName: e.target.value }))}
                placeholder="表示名（例: たろう）"
                className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
              />
              <input
                type="text"
                value={addDraft.loginId}
                onChange={(e) => setAddDraft((d) => ({ ...d, loginId: e.target.value }))}
                placeholder="ログインID（半角英数字4〜32文字）"
                className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
              />
              <input
                type="password"
                value={addDraft.password}
                onChange={(e) => setAddDraft((d) => ({ ...d, password: e.target.value }))}
                placeholder="パスワード（6文字以上）"
                className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
              />
              <button
                type="submit"
                disabled={adding}
                className="rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {adding ? "追加中..." : "追加"}
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">友達一覧</h2>
          {friends.length === 0 && (
            <p className="text-sm text-black/50 dark:text-white/50">まだ友達がいません</p>
          )}
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {friends.map((friend) => (
              <li key={friend.id} className="py-3">
                {editingId === friend.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editDraft.displayName}
                      onChange={(e) => setEditDraft((d) => ({ ...d, displayName: e.target.value }))}
                      placeholder="表示名"
                      className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
                    />
                    <input
                      type="text"
                      value={editDraft.loginId}
                      onChange={(e) => setEditDraft((d) => ({ ...d, loginId: e.target.value }))}
                      placeholder="ログインID"
                      className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
                    />
                    <input
                      type="password"
                      value={editDraft.password}
                      onChange={(e) => setEditDraft((d) => ({ ...d, password: e.target.value }))}
                      placeholder="新しいパスワード（変更する場合のみ）"
                      className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(friend.id)}
                        disabled={rowBusy === friend.id}
                        className="rounded-full bg-[#06C755] px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-black/15 px-4 py-1.5 text-sm dark:border-white/20"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {friend.avatar_emoji} {friend.display_name}
                      </p>
                      <p className="text-xs text-black/50 dark:text-white/50">ID: {friend.login_id}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(friend)}
                        className="rounded-full border border-black/15 px-3 py-1 text-sm dark:border-white/20"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => removeFriend(friend.id)}
                        disabled={rowBusy === friend.id}
                        className="rounded-full border border-red-300 px-3 py-1 text-sm text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
