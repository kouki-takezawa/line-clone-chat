import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendMessage,
  type SendMessageBody,
  type MessageInsertClient,
  type TalkUnhideClient,
} from "@/app/api/messages/sendMessage";

// Thin Next.js wiring around sendMessage() (see sendMessage.ts for the
// actual logic and why it needs both a request-scoped and an admin client).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await req.json()) as SendMessageBody;
  const admin = createAdminClient();
  // Cast through unknown: the real Supabase client structurally satisfies
  // these narrow interfaces (that's what makes them useful for testing),
  // but its full generic type is too deep for tsc to verify that directly
  // (TS2589 "excessively deep") — this boundary cast is the fix, not a
  // type-safety hole, since sendMessage()'s own signature still constrains
  // exactly which calls it can make through these clients.
  const result = await sendMessage(
    supabase as unknown as MessageInsertClient,
    admin as unknown as TalkUnhideClient,
    user.id,
    payload,
  );
  return NextResponse.json(result.body, { status: result.status });
}
