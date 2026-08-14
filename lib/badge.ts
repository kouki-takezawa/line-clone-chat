// The Badging API (app icon count on the home screen) isn't in TS's DOM
// lib yet, and isn't supported everywhere — both failure modes are
// silently ignored, since this is a nicety layered on top of the in-app
// unread badge, never the source of truth for it.
type NavigatorWithBadging = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export async function syncAppBadge(unreadCount: number): Promise<void> {
  const nav = navigator as NavigatorWithBadging;
  try {
    if (unreadCount > 0) {
      await nav.setAppBadge?.(unreadCount);
    } else {
      await nav.clearAppBadge?.();
    }
  } catch {
    // ignore
  }
}
