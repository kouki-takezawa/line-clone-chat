"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// Light obfuscation only, not real security: this is a client component, so
// this value ships inside the browser's JS bundle and is visible to anyone
// who inspects the page source. Change it to something only you'd type.
const UNLOCK_PHRASE = "あじさい2026";

type Task = { id: string; text: string; done: boolean };

const initialTasks: Task[] = [
  { id: "1", text: "牛乳を買う", done: false },
  { id: "2", text: "ゴミ出し（燃えるゴミ）", done: true },
  { id: "3", text: "宿題を終わらせる", done: false },
];

export default function Home() {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [text, setText] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed === UNLOCK_PHRASE) {
      router.push("/login");
      return;
    }

    setTasks((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed, done: false }]);
    setText("");
  }

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white dark:bg-neutral-950">
      <header className="border-b border-black/10 px-4 py-4 dark:border-white/10">
        <h1 className="text-lg font-semibold">ToDo</h1>
      </header>

      <ul className="flex-1 divide-y divide-black/5 overflow-y-auto dark:divide-white/10">
        {tasks.map((task) => (
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
            <span
              className={`text-sm ${
                task.done ? "text-black/40 line-through dark:text-white/40" : "text-black dark:text-white"
              }`}
            >
              {task.text}
            </span>
          </li>
        ))}
      </ul>

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
