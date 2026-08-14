self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "新着メッセージ", body: "" };
  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }

  // Tagging per room (not one shared tag) means a new message from room A
  // no longer silently replaces a still-unread notification from room B —
  // each conversation gets its own replaceable slot.
  const tag = payload.roomId ? `chat-${payload.roomId}` : "chat-message";

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        tag,
        data: { roomId: payload.roomId ?? null },
      });
      if ("setAppBadge" in self.navigator) {
        const notifications = await self.registration.getNotifications();
        await self.navigator.setAppBadge(notifications.length);
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  const roomId = event.notification.data?.roomId;
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = roomId ? `/chat/${roomId}` : "/chat";
      const clientList = await self.clients.matchAll({ type: "window" });
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
