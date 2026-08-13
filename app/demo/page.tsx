"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

type Friend = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

type ThreadMessage = {
  id: string;
  fromMe: boolean;
  body?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  createdAt: Date;
  read?: boolean;
};

const friends: Friend[] = [
  { id: "hanako", name: "はなこ", emoji: "🌸", color: "bg-pink-200" },
  { id: "taro", name: "たろう", emoji: "🚀", color: "bg-sky-200" },
];

// Fixed (not Date.now()-derived) timestamps so server-rendered and
// hydrated markup match exactly.
const initialThreads: Record<string, ThreadMessage[]> = {
  hanako: [
    {
      id: "h1",
      fromMe: false,
      body: "おはよう！今日の集合時間どうする？",
      createdAt: new Date("2026-01-01T09:12:00"),
    },
    {
      id: "h2",
      fromMe: true,
      body: "おはよう😊 19時でどうかな",
      createdAt: new Date("2026-01-01T09:15:00"),
    },
    {
      id: "h3",
      fromMe: false,
      body: "了解、19時に駅前で！",
      createdAt: new Date("2026-01-01T09:19:00"),
    },
  ],
  taro: [
    {
      id: "t1",
      fromMe: false,
      body: "写真送るね📷",
      createdAt: new Date("2026-01-01T08:02:00"),
    },
    {
      id: "t1b",
      fromMe: false,
      mediaUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='100%25' height='100%25' fill='%2394A3B8'/><text x='50%25' y='50%25' font-size='22' fill='white' text-anchor='middle' dominant-baseline='middle'>Photo</text></svg>",
      mediaType: "image",
      createdAt: new Date("2026-01-01T08:03:00"),
    },
    {
      id: "t2",
      fromMe: true,
      body: "ありがとう！",
      createdAt: new Date("2026-01-01T08:05:00"),
    },
  ],
};

const replyPool = ["いいね、了解！", "了解です〜", "オッケー👍", "そうしよう！"];

const backgroundPool = ["今度遊びに行こうよ〜", "そういえば元気にしてる？", "また今度話そうね"];

const ttlOptions = Array.from({ length: 24 }, (_, i) => i + 1); // 1h〜24h

function formatTime(date: Date) {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function lastMessageLabel(msg: ThreadMessage | undefined) {
  if (!msg) return "";
  if (msg.body) return msg.body;
  if (msg.mediaType === "video") return "[動画]";
  if (msg.mediaType === "image") return "[画像]";
  return "";
}

function displayNameOf(friend: Friend, nicknames: Record<string, string>) {
  return nicknames[friend.id] ?? friend.name;
}

export default function DemoPage() {
  const [threads, setThreads] = useState(initialThreads);
  const [openFriendId, setOpenFriendId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [notifOn, setNotifOn] = useState(false);
  const [ttlHours, setTtlHours] = useState(24);
  const [body, setBody] = useState("");
  // Nicknames are per-viewer only: they change how a friend's name shows up
  // on your own screen, never what the friend sees for themselves.
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [typingFriendId, setTypingFriendId] = useState<string | null>(null);
  // In the real app this comes from profiles.is_admin — only the account
  // that owns the deployment can see the settings button. The demo always
  // shows it since there's only ever one demo user ("あなた").
  const isAdmin = true;
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFriend = friends.find((f) => f.id === openFriendId) ?? null;
  const openMessages = openFriendId ? threads[openFriendId] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openMessages?.length, openFriendId, typingFriendId]);

  function addMessage(friendId: string, msg: Omit<ThreadMessage, "id" | "createdAt">) {
    setThreads((prev) => ({
      ...prev,
      [friendId]: [
        ...prev[friendId],
        { ...msg, id: crypto.randomUUID(), createdAt: new Date() },
      ],
    }));
    // Unread badges only count messages that arrive in a thread you're not
    // currently looking at — matches how the real app will track read state.
    if (!msg.fromMe && friendId !== openFriendId) {
      setUnread((prev) => ({ ...prev, [friendId]: (prev[friendId] ?? 0) + 1 }));
    }
  }

  function simulateReply(friendId: string) {
    setTypingFriendId(friendId);
    window.setTimeout(() => {
      setThreads((prev) => ({
        ...prev,
        [friendId]: [
          // The friend replying implies they've seen your messages so far.
          ...prev[friendId].map((m) => (m.fromMe ? { ...m, read: true } : m)),
          {
            id: crypto.randomUUID(),
            fromMe: false,
            body: replyPool[Math.floor(Math.random() * replyPool.length)],
            createdAt: new Date(),
          },
        ],
      }));
      setTypingFriendId((cur) => (cur === friendId ? null : cur));
    }, 1200);

    // Also simulate the *other* friend messaging you in the background, to
    // demonstrate the unread badge showing up on a thread you're not in.
    const other = friends.find((f) => f.id !== friendId);
    if (other) {
      window.setTimeout(() => {
        addMessage(other.id, {
          fromMe: false,
          body: backgroundPool[Math.floor(Math.random() * backgroundPool.length)],
        });
      }, 2600);
    }
  }

  function sendText(e: FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !openFriendId) return;
    addMessage(openFriendId, { fromMe: true, body: text });
    setBody("");
    simulateReply(openFriendId);
  }

  function sendMedia(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !openFriendId) return;
    const mediaUrl = URL.createObjectURL(file);
    const mediaType = file.type.startsWith("video/") ? "video" : "image";
    addMessage(openFriendId, { fromMe: true, mediaUrl, mediaType });
    simulateReply(openFriendId);
  }

  function startEditingName() {
    if (!openFriend) return;
    setNameDraft(displayNameOf(openFriend, nicknames));
    setEditingName(true);
  }

  function saveName() {
    if (!openFriend) return;
    const trimmed = nameDraft.trim();
    setNicknames((prev) => {
      const next = { ...prev };
      if (!trimmed || trimmed === openFriend.name) {
        delete next[openFriend.id];
      } else {
        next[openFriend.id] = trimmed;
      }
      return next;
    });
    setEditingName(false);
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center gap-4 bg-neutral-200 py-0 dark:bg-neutral-900 sm:py-10">
      <p className="mx-auto w-full max-w-md rounded-none bg-amber-100 px-4 py-2 text-center text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 sm:max-w-sm sm:rounded-lg">
        これはデザイン・機能確認用のデモ画面です。ここでの操作はサーバーに保存されません。
        <span className="hidden sm:inline"> スマートフォンでの表示イメージを再現しています。</span>
      </p>

      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-white dark:bg-neutral-950 sm:h-[844px] sm:w-[390px] sm:rounded-[3rem] sm:border-[14px] sm:border-neutral-900 sm:shadow-2xl">
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 hidden h-6 w-28 -translate-x-1/2 rounded-full bg-neutral-900 sm:block" />

        <div className="flex min-h-0 flex-1 flex-col sm:pt-7">
          {showSettings ? (
        <>
          <header className="flex items-center gap-3 bg-[#06C755] px-2 py-3 text-white">
            <button
              onClick={() => setShowSettings(false)}
              aria-label="トーク一覧に戻る"
              className="rounded-full p-2 text-xl leading-none active:bg-white/15"
            >
              ←
            </button>
            <h1 className="text-base font-semibold">設定</h1>
          </header>

          <div className="flex-1 p-4">
            <p className="mb-2 text-sm font-medium">トークの自動削除</p>
            <p className="mb-3 text-xs text-black/50 dark:text-white/50">
              送信したメッセージ（画像含む）を、指定した時間が経過したら自動的に削除します。管理者のみ変更できます。
            </p>
            <select
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value))}
              className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
            >
              {ttlOptions.map((h) => (
                <option key={h} value={h}>
                  {h}時間で削除
                </option>
              ))}
            </select>
          </div>
        </>
      ) : !openFriend ? (
        <>
          <header className="flex items-center justify-between bg-[#06C755] px-4 py-3 text-white">
            <h1 className="text-lg font-semibold">トーク</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNotifOn((v) => !v)}
                aria-pressed={notifOn}
                title={notifOn ? "通知をOFFにする" : "通知をONにする"}
                className="rounded-full bg-white/15 px-3 py-1 text-sm"
              >
                {notifOn ? "🔔 通知ON" : "🔕 通知OFF"}
              </button>
              {isAdmin && (
                <button
                  onClick={() => setShowSettings(true)}
                  aria-label="設定"
                  title="設定（管理者のみ）"
                  className="rounded-full bg-white/15 px-3 py-1 text-sm"
                >
                  ⚙️ 設定
                </button>
              )}
            </div>
          </header>

          <ul className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto dark:divide-white/10">
            {friends.map((friend) => {
              const thread = threads[friend.id];
              const last = thread[thread.length - 1];
              return (
                <li key={friend.id}>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setOpenFriendId(friend.id);
                      setUnread((prev) => ({ ...prev, [friend.id]: 0 }));
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5 dark:active:bg-white/10"
                  >
                    <span className="relative shrink-0">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${friend.color}`}
                      >
                        {friend.emoji}
                      </span>
                      {!!unread[friend.id] && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-medium text-white">
                          {unread[friend.id]}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between">
                        <span className="font-medium">{displayNameOf(friend, nicknames)}</span>
                        <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                          {last ? formatTime(last.createdAt) : ""}
                        </span>
                      </span>
                      <span className="block truncate text-sm text-black/50 dark:text-white/50">
                        {lastMessageLabel(last)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <header className="flex items-center gap-3 bg-[#06C755] px-2 py-3 text-white">
            <button
              onClick={() => {
                setEditingName(false);
                setOpenFriendId(null);
              }}
              aria-label="トーク一覧に戻る"
              className="rounded-full p-2 text-xl leading-none active:bg-white/15"
            >
              ←
            </button>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${openFriend.color}`}
            >
              {openFriend.emoji}
            </span>
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="min-w-0 flex-1 rounded-md bg-white/20 px-2 py-1 text-base font-semibold text-white outline-none placeholder:text-white/70"
                placeholder={openFriend.name}
              />
            ) : (
              <button
                onClick={startEditingName}
                className="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-1 active:bg-white/15"
                title="自分だけに表示される名前を変更"
              >
                <h1 className="truncate text-base font-semibold">
                  {displayNameOf(openFriend, nicknames)}
                </h1>
                <span className="text-sm opacity-80">✏️</span>
              </button>
            )}
          </header>

          {editingName && (
            <p className="bg-[#06C755]/10 px-3 py-1.5 text-center text-xs text-black/60 dark:text-white/60">
              この名前はあなたにだけ表示されます。相手側の表示は変わりません。
            </p>
          )}

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-[#8CC7B5]/15 p-3 dark:bg-neutral-900">
            {openMessages.map((m) => (
              <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                <div className={`flex items-end gap-1.5 ${m.fromMe ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`max-w-56 rounded-2xl px-3 py-2 ${
                      m.fromMe
                        ? "bg-[#06C755] text-white"
                        : "bg-white text-black shadow-sm dark:bg-neutral-800 dark:text-white"
                    }`}
                  >
                    {m.mediaUrl && (
                      <div className="relative mb-1">
                        {m.mediaType === "video" ? (
                          <video
                            src={m.mediaUrl}
                            controls
                            className="max-h-64 rounded-lg object-contain"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.mediaUrl}
                            alt="送信された画像"
                            className="max-h-64 rounded-lg object-contain"
                          />
                        )}
                        {!m.fromMe && (
                          <a
                            href={m.mediaUrl}
                            download={`${openFriend.name}-${m.id}.${m.mediaType === "video" ? "mp4" : "jpg"}`}
                            title="端末に保存"
                            className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-sm text-white"
                          >
                            💾
                          </a>
                        )}
                      </div>
                    )}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-[10px] text-black/40 dark:text-white/40">
                    {m.fromMe && m.read && <span>既読</span>}
                    <span>{formatTime(m.createdAt)}</span>
                  </span>
                </div>
              </div>
            ))}
            {typingFriendId === openFriendId && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-800">
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 dark:bg-white/40"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 dark:bg-white/40"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 dark:bg-white/40"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <p className="bg-white px-3 pt-1 text-center text-[11px] text-black/35 dark:bg-neutral-950 dark:text-white/35">
            メッセージは送信から{ttlHours}時間で自動的に削除されます
          </p>

          <form
            onSubmit={sendText}
            className="flex items-center gap-2 bg-white p-3 dark:bg-neutral-950"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="画像・動画を送信"
              className="shrink-0 rounded-full border border-black/15 px-3 py-2 text-lg dark:border-white/20"
            >
              📷
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={sendMedia}
              className="hidden"
            />
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="メッセージを入力"
              className="flex-1 rounded-full border border-black/15 px-4 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
            />
            <button
              type="submit"
              disabled={!body.trim()}
              className="shrink-0 whitespace-nowrap rounded-full bg-[#06C755] px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              送信
            </button>
          </form>
        </>
      )}
        </div>

        <div className="pointer-events-none absolute bottom-1.5 left-1/2 hidden h-1 w-32 -translate-x-1/2 rounded-full bg-neutral-900/70 sm:block" />
      </div>
    </div>
  );
}
