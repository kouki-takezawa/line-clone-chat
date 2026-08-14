export type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  friend_code: string;
  created_at: string;
};

export type Room = {
  id: string;
  name: string;
  created_at: string;
};

export type RoomMember = {
  room_id: string;
  user_id: string;
  joined_at: string;
  pinned: boolean;
  talk_hidden: boolean;
  friend_removed: boolean;
};

export type FriendRequest = {
  id: string;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  responded_at: string | null;
};

export type Block = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

// Rows returned by the find_profile_by_code / list_*_friend_requests RPCs
// (SECURITY DEFINER functions that can see profiles the caller's own RLS
// grants wouldn't otherwise expose).
export type FoundProfile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
};

type RequestProfileFields = {
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  created_at: string;
};

// id here is the friend_requests row's own id, not the other user's profile id.
export type IncomingFriendRequest = RequestProfileFields & { id: string; from_user: string };
export type OutgoingFriendRequest = RequestProfileFields & { id: string; to_user: string };

export type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
  created_at: string;
};

export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type Settings = {
  id: boolean;
  ttl_hours: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; display_name: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      rooms: {
        Row: Room;
        Insert: Partial<Room>;
        Update: Partial<Room>;
        Relationships: [];
      };
      room_members: {
        Row: RoomMember;
        Insert: Partial<RoomMember> & { room_id: string; user_id: string };
        Update: Partial<RoomMember>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Partial<Message> & { room_id: string; sender_id: string };
        Update: Partial<Message>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Partial<PushSubscriptionRow> & {
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
        };
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
      settings: {
        Row: Settings;
        Insert: Partial<Settings>;
        Update: Partial<Settings>;
        Relationships: [];
      };
      friend_requests: {
        Row: FriendRequest;
        Insert: Partial<FriendRequest> & { from_user: string; to_user: string };
        Update: Partial<FriendRequest>;
        Relationships: [];
      };
      blocks: {
        Row: Block;
        Insert: Partial<Block> & { blocker_id: string; blocked_id: string };
        Update: Partial<Block>;
        Relationships: [];
      };
      message_reactions: {
        Row: MessageReaction;
        Insert: Partial<MessageReaction> & { message_id: string; user_id: string; emoji: string };
        Update: Partial<MessageReaction>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      find_profile_by_code: {
        Args: { code: string };
        Returns: FoundProfile[];
      };
      list_incoming_friend_requests: {
        Args: Record<string, never>;
        Returns: IncomingFriendRequest[];
      };
      list_outgoing_friend_requests: {
        Args: Record<string, never>;
        Returns: OutgoingFriendRequest[];
      };
      accept_friend_request: {
        Args: { request_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// A message joined with its sender's profile, as used by the chat UI.
export type MessageWithSender = Message & { sender: Profile };

// One row in the トーク (talk) list: a room plus the other member and the
// current viewer's own per-room preferences for it.
export type RoomSummary = {
  id: string;
  friend: Profile;
  lastMessage: Message | null;
  pinned: boolean;
};
