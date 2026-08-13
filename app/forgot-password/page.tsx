"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError("送信に失敗しました");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-black/10 p-6 text-center shadow-sm dark:border-white/10">
          <h1 className="text-lg font-semibold">再設定用のメールを送信しました</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {email} 宛にパスワード再設定用のリンクを送信しました。メールをご確認ください。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-black/10 p-6 shadow-sm dark:border-white/10"
      >
        <h1 className="text-xl font-semibold">パスワードをお忘れの方へ</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          登録済みのメールアドレスを入力してください。再設定用のリンクをお送りします。
        </p>

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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-black px-3 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "送信中..." : "送信"}
        </button>

        <p className="text-center text-sm">
          <Link href="/login" className="underline">
            ログイン画面に戻る
          </Link>
        </p>
      </form>
    </main>
  );
}
