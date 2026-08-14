"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const MIN_PASSWORD_LENGTH = 8;

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
      return;
    }
    if (!displayName.trim()) {
      setError("表示名を入力してください");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: displayName.trim() }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "登録に失敗しました");
      return;
    }

    router.replace("/chat");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-black/10 p-6 shadow-sm dark:border-white/10"
      >
        <h1 className="text-xl font-semibold">新規登録</h1>

        <div className="space-y-1">
          <label htmlFor="displayName" className="text-sm font-medium">
            表示名
          </label>
          <input
            id="displayName"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            パスワード（{MIN_PASSWORD_LENGTH}文字以上）
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-3 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "登録中..." : "登録"}
        </button>

        <p className="text-center text-sm">
          <Link href="/login" className="underline">
            すでにアカウントをお持ちの方はこちら
          </Link>
        </p>
      </form>
    </main>
  );
}
