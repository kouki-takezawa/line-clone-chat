import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

export default function AdminHeader({ title, back }: { title: string; back?: boolean }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="space-y-1">
        {back && (
          <Link href="/" className="text-sm text-white/50 underline">
            ← ダッシュボードへ戻る
          </Link>
        )}
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <nav className="flex items-center gap-3 text-sm">
        <Link href="/" className="rounded-full border border-white/20 px-4 py-2">
          アカウント
        </Link>
        <Link href="/broadcast" className="rounded-full border border-white/20 px-4 py-2">
          全体配信
        </Link>
        <Link href="/audit" className="rounded-full border border-white/20 px-4 py-2">
          監査ログ
        </Link>
        <LogoutButton />
      </nav>
    </div>
  );
}
