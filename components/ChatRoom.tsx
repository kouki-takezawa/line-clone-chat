"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage, getImageDimensions } from "@/lib/image";
import type { Message, MessageReaction, MessageWithSender, Profile } from "@/lib/types";
import MessageList from "@/components/MessageList";
import Composer from "@/components/Composer";
import Avatar from "@/components/Avatar";
import type { RealtimeChannel } from "@supabase/supabase-js";

const MAX_MESSAGE_LENGTH = 1000;
const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024;

export type PendingMessage = MessageWithSender & {
  status?: "pending" | "failed";
  errorMessage?: string;
};

type Props = {
  roomId: string;
  currentUserId: string;
  friend: Profile;
  initialMessages: MessageWithSender[];
  initialReactions: MessageReaction[];
  members: Profile[];
  ttlHours: number;
};

function describeError(error: { message: string }, fallback: string): string {
  if (error.message.includes("rate limit")) {
    return error.message.includes("image")
      ? "画像の送信が多すぎます。しばらく待ってから送信してください"
      : "送信が速すぎます。少し待ってから送信してください";
  }
  if (error.message.includes("messages_body_length")) {
    return `メッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください`;
  }
  return fallback;
}

export default function ChatRoom({
  roomId,
  currentUserId,
  friend,
  initialMessages,
  initialReactions,
  members,
  ttlHours,
}: Props) {
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>(() => {
    const grouped: Record<string, MessageReaction[]> = {};
    for (const r of initialReactions) {
      (grouped[r.message_id] ??= []).push(r);
    }
    return grouped;
  });
  const [imageError, setImageError] = useState<string | null>(null);
  const [friendTyping, setFriendTyping] = useState(false);

  const membersRef = useRef(members);
  const messageIdsRef = useRef(new Set(initialMessages.map((m) => m.id)));
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    messageIdsRef.current = new Set(messages.filter((m) => m.status !== "pending").map((m) => m.id));
  }, [messages]);

  // Note: opening a talk does NOT un-hide it from the トーク list anymore —
  // only a new message (sent or received) does, via a DB trigger
  // (0010_unhide_on_new_message.sql). Otherwise "delete" would be undone
  // just by looking at the conversation from 友達一覧.

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    // createBrowserClient's session is restored from cookies asynchronously
    // on a fresh page load. Subscribing before that finishes registers the
    // channel without a valid access token, and it silently never receives
    // postgres_changes events afterward (a later token refresh doesn't
    // retroactively fix an already-broken subscription) — so this must wait
    // for the session before calling .subscribe().
    supabase.auth.getSession().then(() => {
      if (cancelled) return;

      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
          (payload) => {
            const row = payload.new as Message;
            const sender = membersRef.current.find((m) => m.id === row.sender_id);
            if (!sender) return;
            setMessages((prev) =>
              prev.some((m) => m.id === row.id)
                ? prev.map((m) => (m.id === row.id ? { ...row, sender } : m))
                : [...prev, { ...row, sender }],
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
          (payload) => {
            const oldRow = payload.old as Partial<Message>;
            setMessages((prev) => prev.filter((m) => m.id !== oldRow.id));
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "message_reactions" },
          (payload) => {
            const row = payload.new as MessageReaction;
            if (!messageIdsRef.current.has(row.message_id)) return;
            setReactions((prev) => ({
              ...prev,
              [row.message_id]: [
                ...(prev[row.message_id] ?? []).filter((r) => r.user_id !== row.user_id),
                row,
              ],
            }));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "message_reactions" },
          (payload) => {
            const row = payload.new as MessageReaction;
            if (!messageIdsRef.current.has(row.message_id)) return;
            setReactions((prev) => ({
              ...prev,
              [row.message_id]: [
                ...(prev[row.message_id] ?? []).filter((r) => r.user_id !== row.user_id),
                row,
              ],
            }));
          },
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "message_reactions" },
          (payload) => {
            const oldRow = payload.old as Partial<MessageReaction>;
            if (!oldRow.message_id) return;
            setReactions((prev) => ({
              ...prev,
              [oldRow.message_id!]: (prev[oldRow.message_id!] ?? []).filter(
                (r) => r.user_id !== oldRow.user_id,
              ),
            }));
          },
        )
        .on("broadcast", { event: "typing" }, (msg) => {
          const payload = msg.payload as { userId?: string };
          if (payload.userId === currentUserId) return;
          setFriendTyping(true);
          if (typingClearRef.current) clearTimeout(typingClearRef.current);
          typingClearRef.current = setTimeout(() => setFriendTyping(false), 3000);
        })
        .subscribe();

      channelRef.current = channel;
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      channelRef.current = null;
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
    };
  }, [roomId, currentUserId]);

  const sendText = useCallback(
    async (text: string) => {
      const clientId = crypto.randomUUID();
      const me = membersRef.current.find((m) => m.id === currentUserId);
      if (!me) return;

      setMessages((prev) => [
        ...prev,
        {
          id: clientId,
          room_id: roomId,
          sender_id: currentUserId,
          body: text,
          image_path: null,
          image_width: null,
          image_height: null,
          created_at: new Date().toISOString(),
          sender: me,
          status: "pending",
        },
      ]);

      const supabase = createClient();
      const { error } = await supabase
        .from("messages")
        .insert({ id: clientId, room_id: roomId, sender_id: currentUserId, body: text });

      if (error) {
        const errorMessage = describeError(error, "送信に失敗しました");
        setMessages((prev) =>
          prev.map((m) => (m.id === clientId ? { ...m, status: "failed", errorMessage } : m)),
        );
      }
    },
    [roomId, currentUserId],
  );

  const sendImage = useCallback(
    async (file: File, width: number, height: number) => {
      const clientId = crypto.randomUUID();
      const me = membersRef.current.find((m) => m.id === currentUserId);
      if (!me) return;
      const localUrl = URL.createObjectURL(file);

      setMessages((prev) => [
        ...prev,
        {
          id: clientId,
          room_id: roomId,
          sender_id: currentUserId,
          body: null,
          image_path: localUrl, // local blob URL until confirmed; MessageBubble treats http(s)/blob specially
          image_width: width,
          image_height: height,
          created_at: new Date().toISOString(),
          sender: me,
          status: "pending",
        },
      ]);

      try {
        const supabase = createClient();
        const path = `${roomId}/${clientId}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(path, file, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from("messages").insert({
          id: clientId,
          room_id: roomId,
          sender_id: currentUserId,
          image_path: path,
          image_width: width,
          image_height: height,
        });
        if (insertError) throw insertError;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? describeError(err, "画像の送信に失敗しました") : "画像の送信に失敗しました";
        setMessages((prev) =>
          prev.map((m) => (m.id === clientId ? { ...m, status: "failed", errorMessage } : m)),
        );
      }
    },
    [roomId, currentUserId],
  );

  async function retry(message: PendingMessage) {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: "pending" } : m)));
    const supabase = createClient();

    if (message.image_path && message.image_path.startsWith("blob:")) {
      // Original File object isn't retained across a failed image send in
      // this simple design — the user is asked to re-attach instead.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, status: "failed", errorMessage: "画像の送信に失敗しました。再度選択してください" }
            : m,
        ),
      );
      return;
    }

    const { error } = await supabase
      .from("messages")
      .insert({ id: message.id, room_id: roomId, sender_id: currentUserId, body: message.body });
    if (error) {
      const errorMessage = describeError(error, "送信に失敗しました");
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, status: "failed", errorMessage } : m)),
      );
    }
  }

  function removeFailed(clientId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== clientId));
  }

  async function unsend(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const supabase = createClient();
    await supabase.from("messages").delete().eq("id", messageId);
  }

  async function react(messageId: string, emoji: string) {
    const supabase = createClient();
    const mine = reactions[messageId]?.find((r) => r.user_id === currentUserId);

    if (mine?.emoji === emoji) {
      setReactions((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? []).filter((r) => r.user_id !== currentUserId),
      }));
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", currentUserId);
      return;
    }

    setReactions((prev) => ({
      ...prev,
      [messageId]: [
        ...(prev[messageId] ?? []).filter((r) => r.user_id !== currentUserId),
        { message_id: messageId, user_id: currentUserId, emoji, created_at: new Date().toISOString() },
      ],
    }));
    await supabase
      .from("message_reactions")
      .upsert({ message_id: messageId, user_id: currentUserId, emoji });
  }

  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId } });
  }

  async function handleSendImage(file: File) {
    if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
      setImageError("画像が大きすぎます（20MB以下にしてください）");
      return;
    }
    setImageError(null);
    try {
      const compressed = await compressImage(file);
      const { width, height } = await getImageDimensions(compressed);
      void sendImage(compressed, width, height);
    } catch {
      setImageError("画像の処理に失敗しました");
    }
  }

  return (
    // position: fixed for the same reason as the (tabs) shell: the root
    // layout's <body> only has a min-height, so without this, a long
    // message list would grow the whole page instead of scrolling inside
    // MessageList — dragging the header and composer along with it.
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-neutral-950">
      <header className="flex items-center gap-3 border-b border-black/10 bg-white px-2 py-3 dark:border-white/10 dark:bg-neutral-950">
        <Link
          href="/chat"
          aria-label="トーク一覧に戻る"
          className="rounded-full p-2 text-xl leading-none text-black active:bg-black/5 dark:text-white dark:active:bg-white/10"
        >
          ←
        </Link>
        <Avatar profile={friend} size="h-9 w-9" />
        <h1 className="truncate text-base font-semibold">{friend.display_name}</h1>
      </header>

      <MessageList
        messages={messages}
        reactions={reactions}
        currentUserId={currentUserId}
        ttlHours={ttlHours}
        onReact={react}
        onUnsend={unsend}
        onRetry={retry}
        onDismissFailed={removeFailed}
      />

      <div className="bg-white px-3 pt-1 dark:bg-neutral-950">
        <p className="text-center text-[11px] text-black/35 dark:text-white/35">
          メッセージは送信から{ttlHours}時間で自動的に削除されます
        </p>
        {friendTyping && (
          <p className="pt-0.5 text-center text-[11px] text-black/50 dark:text-white/50">入力中...</p>
        )}
      </div>

      <Composer onSendText={sendText} onSendImage={handleSendImage} onTyping={notifyTyping} error={imageError} />
    </div>
  );
}
