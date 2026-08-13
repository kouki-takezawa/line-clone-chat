"use client";

import { useEffect, useState } from "react";
import { disableNotifications, enableNotifications, getExistingSubscription } from "@/lib/push";

type Props = {
  currentUserId: string;
};

export default function NotificationToggle({ currentUserId }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    getExistingSubscription().then((sub) => setEnabled(!!sub));
  }, []);

  async function toggle() {
    if (busy) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setBusy(true);
    try {
      if (enabled) {
        await disableNotifications();
        setEnabled(false);
      } else {
        await enableNotifications(currentUserId);
        setEnabled(true);
      }
    } catch {
      // permission denied or unsupported — leave state unchanged
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={enabled}
      title={enabled ? "通知をOFFにする" : "通知をONにする"}
      className={`rounded-full border px-3 py-1.5 text-sm disabled:opacity-50 ${
        enabled
          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
          : "border-black/15 dark:border-white/20"
      }`}
    >
      {enabled ? "🔔 通知ON" : "🔕 通知OFF"}
    </button>
  );
}
