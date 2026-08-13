"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { avatarColorFor } from "@/lib/avatarColor";
import NotificationToggle from "@/components/NotificationToggle";

type Props = {
  currentUserId: string;
  email: string;
  displayName: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  ttlHours: number;
};

export default function SettingsPanel({
  currentUserId,
  email,
  displayName: initialDisplayName,
  avatarEmoji,
  avatarUrl: initialAvatarUrl,
  ttlHours,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      // Uploaded via a server route (not the browser Supabase client) so the
      // upload path is derived from the authenticated session server-side,
      // not trusted from the client.
      const res = await fetch("/api/avatar", { method: "POST", body: compressed });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "upload failed");

      setAvatarUrl(data.url);
    } catch {
      setError("画像のアップロードに失敗しました");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || initialDisplayName })
      .eq("id", currentUserId);

    setSavingProfile(false);
    if (updateError) {
      setError("表示名の更新に失敗しました");
      return;
    }
    setProfileSaved(true);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("パスワードは8文字以上で入力してください");
      return;
    }
    setSavingPassword(true);
    setPasswordSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    setSavingPassword(false);
    if (updateError) {
      setError("パスワードの変更に失敗しました");
      return;
    }
    setNewPassword("");
    setPasswordSaved(true);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <h1 className="text-lg font-semibold">設定</h1>
      </header>

      <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-4 pb-20">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">プロフィール</h2>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full disabled:opacity-50"
              title="タップして画像を変更"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  className={`flex h-full w-full items-center justify-center text-3xl ${avatarColorFor(currentUserId)}`}
                >
                  {avatarEmoji}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-[10px] text-white">
                {uploadingAvatar ? "..." : "変更"}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-xs text-black/50 dark:text-white/50">{email}</p>
          </div>

          <form onSubmit={saveProfile} className="space-y-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="表示名"
              className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
            />
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingProfile ? "保存中..." : "保存"}
            </button>
            {profileSaved && (
              <span className="ml-2 text-sm text-black/50 dark:text-white/50">保存しました</span>
            )}
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">パスワード変更</h2>
          <form onSubmit={savePassword} className="space-y-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード（8文字以上）"
              className="w-full rounded-lg border border-black/15 px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
            />
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-full bg-[#06C755] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingPassword ? "変更中..." : "変更する"}
            </button>
            {passwordSaved && (
              <span className="ml-2 text-sm text-black/50 dark:text-white/50">変更しました</span>
            )}
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">通知</h2>
          <NotificationToggle currentUserId={currentUserId} />
        </section>

        <section className="space-y-1">
          <h2 className="text-sm font-semibold">メッセージの自動削除</h2>
          <p className="text-xs text-black/50 dark:text-white/50">
            送信したメッセージ・画像は送信から{ttlHours}時間で自動的に削除されます。
          </p>
        </section>

        <section>
          <button
            onClick={handleSignOut}
            className="w-full rounded-full border border-black/15 px-4 py-2 text-sm text-black/60 dark:border-white/20 dark:text-white/60"
          >
            ログアウト
          </button>
        </section>
      </div>
    </div>
  );
}
