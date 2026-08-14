"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import type { IncomingFriendRequest, OutgoingFriendRequest } from "@/lib/types";

export default function FriendRequestsPage() {
  const [incoming, setIncoming] = useState<IncomingFriendRequest[] | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: inData }, { data: outData }] = await Promise.all([
      supabase.rpc("list_incoming_friend_requests"),
      supabase.rpc("list_outgoing_friend_requests"),
    ]);
    setIncoming(inData ?? []);
    setOutgoing(outData ?? []);
  }, []);

  useEffect(() => {
    // One-time data load on mount; there's no external-system subscription
    // to hang this off of the way the rule's preferred pattern expects.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function accept(requestId: string, fromUserId: string) {
    setBusyId(requestId);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("accept_friend_request", { request_id: requestId });
    setBusyId(null);
    if (error) {
      setError("承認に失敗しました");
      return;
    }
    setIncoming((prev) => prev?.filter((r) => r.id !== requestId) ?? null);
    setMessage("友達になりました！");
    fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "friend_accepted", toUserId: fromUserId }),
    }).catch(() => {});
  }

  async function reject(requestId: string) {
    setBusyId(requestId);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "rejected", responded_at: new Date().toISOString() })
      .eq("id", requestId);
    setBusyId(null);
    if (error) {
      setError("操作に失敗しました");
      return;
    }
    setIncoming((prev) => prev?.filter((r) => r.id !== requestId) ?? null);
  }

  async function cancel(requestId: string) {
    setBusyId(requestId);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
    setBusyId(null);
    if (error) {
      setError("取り消しに失敗しました");
      return;
    }
    setOutgoing((prev) => prev?.filter((r) => r.id !== requestId) ?? null);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <Link href="/home" aria-label="友達一覧に戻る" className="text-lg">
          ←
        </Link>
        <h1 className="text-lg font-semibold">届いている申請</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-4 pb-20">
        {message && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">届いている申請</h2>
          {incoming === null ? (
            <p className="text-sm text-black/40 dark:text-white/40">読み込み中...</p>
          ) : incoming.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40">届いている申請はありません</p>
          ) : (
            <ul className="space-y-2">
              {incoming.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
                >
                  <Avatar profile={req} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{req.display_name}</span>
                    {req.message && (
                      <span className="block truncate text-xs text-black/50 dark:text-white/50">
                        {req.message}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => reject(req.id)}
                    disabled={busyId === req.id}
                    className="shrink-0 rounded-full border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/20"
                  >
                    拒否
                  </button>
                  <button
                    type="button"
                    onClick={() => accept(req.id, req.from_user)}
                    disabled={busyId === req.id}
                    className="shrink-0 rounded-full bg-[#06C755] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    承認
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">送信済みの申請</h2>
          {outgoing === null ? (
            <p className="text-sm text-black/40 dark:text-white/40">読み込み中...</p>
          ) : outgoing.length === 0 ? (
            <p className="text-sm text-black/40 dark:text-white/40">送信済みの申請はありません</p>
          ) : (
            <ul className="space-y-2">
              {outgoing.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10"
                >
                  <Avatar profile={req} />
                  <span className="flex-1 font-medium">{req.display_name}</span>
                  <button
                    type="button"
                    onClick={() => cancel(req.id)}
                    disabled={busyId === req.id}
                    className="rounded-full border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/20"
                  >
                    取り消し
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
