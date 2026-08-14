// Fire-and-forget: push delivery is a nicety, never something that should
// block or fail the action it's attached to. Centralized here since the
// same three shapes were being hand-written inline at each call site.
function notify(body: { type: string; [key: string]: unknown }) {
  fetch("/api/push/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function notifyMessage(roomId: string, body: string) {
  notify({ type: "message", roomId, body });
}

export function notifyFriendRequest(toUserId: string) {
  notify({ type: "friend_request", toUserId });
}

export function notifyFriendAccepted(toUserId: string) {
  notify({ type: "friend_accepted", toUserId });
}
