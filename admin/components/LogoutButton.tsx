"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="rounded-full border border-white/20 px-4 py-2 text-sm">
      ログアウト
    </button>
  );
}
