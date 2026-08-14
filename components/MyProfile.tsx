"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import Avatar from "@/components/Avatar";
import SnsLinks from "@/components/SnsLinks";
import type { Profile } from "@/lib/types";

export default function MyProfile({ profile }: { profile: Profile }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(profile.friend_code, { width: 200, margin: 1 }).then(setQrDataUrl);
  }, [profile.friend_code]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
        <Link href="/home" aria-label="友達一覧に戻る" className="text-lg">
          ←
        </Link>
        <h1 className="text-lg font-semibold">マイプロフィール</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center gap-3">
          <Avatar profile={profile} size="h-24 w-24" />
          <p className="text-xl font-semibold">{profile.display_name}</p>
          <SnsLinks xHandle={profile.x_handle} instagramHandle={profile.instagram_handle} />
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border border-black/10 p-4 dark:border-white/10">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="自分のQRコード" className="h-40 w-40" />
          )}
          <p className="text-xs text-black/50 dark:text-white/50">あなたのID</p>
          <p className="font-mono text-lg tracking-wider">{profile.friend_code}</p>
        </div>

        <Link
          href="/settings"
          className="mt-8 block w-full rounded-full border border-black/15 px-4 py-2 text-center text-sm dark:border-white/20"
        >
          プロフィールを編集
        </Link>
      </div>
    </div>
  );
}
