import { createClient } from "@/lib/supabase/client";
import type { RoomMember } from "@/lib/types";

type Patch = Partial<
  Pick<RoomMember, "pinned" | "talk_hidden" | "friend_removed" | "muted" | "last_read_at">
>;

// The "update my own room_members row" pattern (pin, mute, hide talk,
// remove friend, mark read) was repeated at every call site with only the
// patch object differing — centralized so the .eq() pair (the part that
// actually matters for correctness: touching only the caller's own row,
// never the other participant's) can't drift between them.
export async function updateMyRoomMember(roomId: string, userId: string, patch: Patch) {
  const supabase = createClient();
  return supabase.from("room_members").update(patch).eq("room_id", roomId).eq("user_id", userId);
}
