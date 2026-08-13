"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: string };

export default function BottomTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: "/home", label: "友達一覧", icon: "👥" },
    { href: "/chat", label: "トーク", icon: "💬" },
    ...(isAdmin ? [{ href: "/settings", label: "設定", icon: "⚙️" }] : []),
  ];

  return (
    <nav className="flex shrink-0 border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)] dark:border-white/10 dark:bg-neutral-950">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "text-[#06C755]" : "text-black/40 dark:text-white/40"
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
