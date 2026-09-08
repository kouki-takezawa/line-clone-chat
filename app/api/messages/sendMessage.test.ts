import { test } from "node:test";
import assert from "node:assert/strict";
import { sendMessage, type MessageInsertClient, type TalkUnhideClient } from "./sendMessage.ts";

// Fakes stand in for the real Supabase clients and record every call, so
// each test can assert both the HTTP-level result and exactly what would
// have hit the database — this is what a real Postgres/RLS run isn't
// available to check in this environment (see conversation).

function fakeSupabase(insertError: { message: string } | null = null) {
  const calls: { table: string; row: Record<string, unknown> }[] = [];
  const client: MessageInsertClient = {
    from(table) {
      return {
        insert(row) {
          calls.push({ table, row });
          return Promise.resolve({ error: insertError });
        },
      };
    },
  };
  return { client, calls };
}

function fakeAdmin() {
  const calls: { roomId: string; talkHiddenFilter: boolean; values: { talk_hidden: false } }[] = [];
  const client: TalkUnhideClient = {
    from() {
      return {
        update(values) {
          return {
            eq(_col, roomId) {
              return {
                eq(_col2, talkHiddenFilter) {
                  calls.push({ roomId, talkHiddenFilter, values });
                  return Promise.resolve(null);
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test("delivers a text message and un-hides the talk for whoever had it hidden", async () => {
  const { client: supabase, calls: inserts } = fakeSupabase();
  const { client: admin, calls: unhides } = fakeAdmin();

  const result = await sendMessage(supabase, admin, "user-B", {
    id: "msg-1",
    roomId: "room-R",
    body: "hello",
  });

  assert.deepEqual(result, { status: 200, body: { ok: true } });

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].table, "messages");
  assert.equal(inserts[0].row.sender_id, "user-B", "sender_id must come from the authenticated caller, not the payload");
  assert.equal(inserts[0].row.room_id, "room-R");
  assert.equal(inserts[0].row.body, "hello");

  assert.equal(unhides.length, 1, "must clear talk_hidden after a successful insert");
  assert.equal(unhides[0].roomId, "room-R", "must only touch the room the message was sent into");
  assert.equal(unhides[0].talkHiddenFilter, true, "must only flip rows that were actually hidden");
  assert.deepEqual(unhides[0].values, { talk_hidden: false });
});

test("delivers an image message the same way", async () => {
  const { client: supabase, calls: inserts } = fakeSupabase();
  const { client: admin, calls: unhides } = fakeAdmin();

  const result = await sendMessage(supabase, admin, "user-B", {
    id: "msg-2",
    roomId: "room-R",
    imagePath: "room-R/msg-2.jpg",
    imageWidth: 100,
    imageHeight: 200,
  });

  assert.deepEqual(result, { status: 200, body: { ok: true } });
  assert.equal(inserts[0].row.image_path, "room-R/msg-2.jpg");
  assert.equal(unhides.length, 1);
});

test("rejects a payload with neither text nor image, and never touches the DB", async () => {
  const { client: supabase, calls: inserts } = fakeSupabase();
  const { client: admin, calls: unhides } = fakeAdmin();

  const result = await sendMessage(supabase, admin, "user-B", { id: "msg-3", roomId: "room-R" });

  assert.deepEqual(result, { status: 400, body: { error: "invalid request" } });
  assert.equal(inserts.length, 0);
  assert.equal(unhides.length, 0);
});

test("does not un-hide the talk when the insert is rejected (e.g. blocked pair via RLS)", async () => {
  const { client: supabase } = fakeSupabase({ message: "new row violates row-level security policy" });
  const { client: admin, calls: unhides } = fakeAdmin();

  const result = await sendMessage(supabase, admin, "user-B", {
    id: "msg-4",
    roomId: "room-R",
    body: "hi",
  });

  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: "new row violates row-level security policy" });
  assert.equal(unhides.length, 0, "a failed send must not un-hide a talk that had nothing new happen in it");
});

test("un-hides the talk for a room the sender had themselves deleted, by re-sending into it", async () => {
  // This is the scenario from the bug report: A deletes the talk (their own
  // room_members.talk_hidden = true), then a new message arrives — sent by
  // either party — and the talk should reappear in A's list. The filter is
  // symmetric (room_id + talk_hidden = true), so it doesn't matter who sent
  // the message that un-hides it.
  const { client: supabase } = fakeSupabase();
  const { client: admin, calls: unhides } = fakeAdmin();

  await sendMessage(supabase, admin, "user-A", { id: "msg-5", roomId: "room-R", body: "sorry, ignore that" });

  assert.equal(unhides.length, 1);
  assert.equal(unhides[0].roomId, "room-R");
  assert.equal(unhides[0].talkHiddenFilter, true);
});
