"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginIdToEmail } from "@/lib/loginId";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginIdToEmail(loginId),
      password,
    });

    setLoading(false);

    if (error) {
      setError("ログインIDかパスワードが違います");
      return;
    }

    // replace() alone already fetches /chat fresh (reading the just-set
    // session cookie); a follow-up refresh() would just re-fetch it again.
    router.replace("/chat");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-black/10 p-6 shadow-sm dark:border-white/10"
      >
        <h1 className="text-xl font-semibold">ログイン</h1>

        <div className="space-y-1">
          <label htmlFor="loginId" className="text-sm font-medium">
            ログインID
          </label>
          <input
            id="loginId"
            type="text"
            required
            autoComplete="username"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full rounded-lg border border-black/15 px-3 py-2 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
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
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
