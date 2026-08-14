"use client";

import { useEffect } from "react";
import { syncAppBadge } from "@/lib/badge";

// Renders nothing — just keeps the home-screen icon's badge count in sync
// with the real total unread count every time the talk list loads, which
// corrects any drift from the service worker's own (best-effort, per-push)
// badge updates.
export default function BadgeSync({ unreadCount }: { unreadCount: number }) {
  useEffect(() => {
    void syncAppBadge(unreadCount);
  }, [unreadCount]);

  return null;
}
