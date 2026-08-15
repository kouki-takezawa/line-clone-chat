"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "ログインに失敗しました");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6"
      >
        <h1 className="text-xl font-semibold">管理画面ログイン</h1>
        <input
          type="text"
          required
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ユーザー名"
          autoComplete="username"
          className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 outline-none focus:border-white/50"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード"
          autoComplete="current-password"
          className="w-full rounded-lg border border-white/20 bg-transparent px-3 py-2 outline-none focus:border-white/50"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-white px-3 py-2 font-medium text-black disabled:opacity-50"
        >
          {loading ? "確認中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
