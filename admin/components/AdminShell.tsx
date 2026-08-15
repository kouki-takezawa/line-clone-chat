"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import ToastProvider from "@/components/ToastProvider";
import ConfirmProvider from "@/components/ConfirmProvider";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード" },
  { href: "/broadcast", label: "全体配信" },
  { href: "/stats", label: "統計" },
  { href: "/audit", label: "監査ログ" },
  { href: "/admins", label: "管理者" },
];

export default function AdminShell({ username, children }: { username: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-dvh">
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-neutral-950/90 px-4 py-3 backdrop-blur">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="メニュー"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 text-lg"
            >
              ☰
            </button>
            <span className="font-semibold">管理画面</span>
            {username && <span className="ml-auto text-sm text-white/50">{username}</span>}
            <LogoutButton />
          </header>

          {open && (
            <button
              aria-label="閉じる"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30 bg-black/50"
            />
          )}

          <aside
            className={`fixed inset-y-0 left-0 z-40 w-64 -translate-x-full border-r border-white/10 bg-neutral-950 pt-16 transition-transform ${
              open ? "translate-x-0" : ""
            }`}
          >
            <nav className="flex flex-col gap-1 p-3">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      active ? "bg-white text-black" : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <main className="mx-auto max-w-5xl p-6">{children}</main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
