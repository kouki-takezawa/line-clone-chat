"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// The unlock phrase is today's date (yyyy/mm/dd), based on the device's own
// clock. Light obfuscation only, not real security — someone who knows the
// scheme could still guess it.
function todaysUnlockPhrase(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

type Task = { id: string; text: string; done: boolean; createdAt: number };

const STORAGE_KEY = "todo-app-tasks";

// Fixed historical timestamps (not Date.now()) so the seed data itself
// renders identically on the server and after client hydration; only the
// *relative* time text derived from them varies with "now", which is why
// that text is marked suppressHydrationWarning below.
const initialTasks: Task[] = [
  { id: "1", text: "牛乳を買う", done: false, createdAt: new Date("2026-08-10T09:00:00").getTime() },
  { id: "2", text: "ゴミ出し（燃えるゴミ）", done: true, createdAt: new Date("2026-08-09T07:30:00").getTime() },
  { id: "3", text: "宿題を終わらせる", done: false, createdAt: new Date("2026-08-08T20:15:00").getTime() },
  { id: "4", text: "図書館の本を返す", done: true, createdAt: new Date("2026-08-07T12:00:00").getTime() },
];

function relativeTime(ts: number): string {
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}日前`;
  return new Date(ts).toLocaleDateString("ja-JP");
}

export default function Home() {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load any previously saved tasks after mount (localStorage isn't
  // available during SSR, so this can't run before hydration).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // One-time localStorage hydration; there's no external-system callback
      // to hang this off of the way the rule's preferred pattern expects.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setTasks(JSON.parse(saved));
    } catch {
      // ignore corrupt/unavailable storage, keep the seed list
    }
    setLoaded(true);
  }, []);

  // Persist on every change, but only once the initial load above has run —
  // otherwise this would fire first and overwrite saved data with the seed.
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, loaded]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed === todaysUnlockPhrase()) {
      router.push("/login");
      return;
    }

    setTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: trimmed, done: false, createdAt: Date.now() },
    ]);
    setText("");
  }

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function clearCompleted() {
    setTasks((prev) => prev.filter((t) => !t.done));
  }

  const doneCount = tasks.filter((t) => t.done).length;
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white dark:bg-neutral-950">
      <header className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold">ToDo</h1>
        <p className="text-xs text-black/40 dark:text-white/40">
          {tasks.length}件中{doneCount}件完了
        </p>
      </header>

      {tasks.length === 0 ? (
        <p className="flex-1 p-6 text-center text-sm text-black/40 dark:text-white/40">
          タスクはありません
        </p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto dark:divide-white/10">
          {sortedTasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                aria-label={task.done ? "未完了に戻す" : "完了にする"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  task.done
                    ? "border-neutral-700 bg-neutral-700 text-white dark:border-neutral-300 dark:bg-neutral-300 dark:text-black"
                    : "border-black/30 dark:border-white/30"
                }`}
              >
                {task.done && "✓"}
              </button>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm ${
                    task.done ? "text-black/40 line-through dark:text-white/40" : "text-black dark:text-white"
                  }`}
                >
                  {task.text}
                </span>
                <span
                  className="text-[11px] text-black/35 dark:text-white/35"
                  suppressHydrationWarning
                >
                  {relativeTime(task.createdAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => deleteTask(task.id)}
                aria-label="削除"
                className="shrink-0 rounded-full px-2 py-1 text-black/30 hover:text-black/60 dark:text-white/30 dark:hover:text-white/60"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 && (
        <div className="border-t border-black/10 px-4 py-2 dark:border-white/10">
          <button
            type="button"
            onClick={clearCompleted}
            className="text-xs text-black/40 hover:text-black/60 dark:text-white/40 dark:hover:text-white/60"
          >
            完了済みを削除（{doneCount}件）
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-black/10 p-3 dark:border-white/10"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="新しいタスクを入力"
          className="flex-1 rounded-full border border-black/15 px-4 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 whitespace-nowrap rounded-full bg-neutral-800 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-neutral-200 dark:text-black"
        >
          追加
        </button>
      </form>
    </main>
  );
}
