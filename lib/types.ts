export type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  login_id: string | null;
  is_admin: boolean;
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
};

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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
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
