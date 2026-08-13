import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Standard @supabase/ssr callback: exchanges the code from an email
// confirmation or password-recovery link for a real session. Used for both
// flows — `next` tells it where to send the user afterward.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/chat";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
