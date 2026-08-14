import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/types";

export type RoomMembershipRow = {
  room_id: string;
  user_id: string;
  pinned: boolean;
  talk_hidden: boolean;
  friend_removed: boolean;
  muted: boolean;
  last_read_at: string;
  profile: Profile | null;
};

// Every room in this app has exactly two members, so "all of my
// room_members rows, each with its profile joined" is the base query
// every friend-list/talk-list/profile screen needs — this centralizes the
// query shape so a future column addition only has to happen in one
// place, instead of each page having quietly drifted its own copy.
export async function getMyRoomMemberships(
  supabase: SupabaseClient<Database>,
): Promise<RoomMembershipRow[]> {
  const { data } = await supabase
    .from("room_members")
    .select("room_id, user_id, pinned, talk_hidden, friend_removed, muted, last_read_at, profile:profiles(*)");
  return (data as unknown as RoomMembershipRow[]) ?? [];
}

// The two things almost every caller wants out of the flat row list: my
// own row per room, and the other member's row per room.
export function splitByViewer(rows: RoomMembershipRow[], userId: string) {
  const mine = new Map<string, RoomMembershipRow>();
  const others = new Map<string, RoomMembershipRow>();
  for (const row of rows) {
    if (row.user_id === userId) mine.set(row.room_id, row);
    else others.set(row.room_id, row);
  }
  return { mine, others };
}
