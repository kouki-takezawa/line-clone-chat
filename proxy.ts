import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // /demo is a static, backend-free design preview and intentionally
    // skips auth gating (it never talks to Supabase). "/" (the disguise
    // screen) is excluded inside updateSession itself, not here.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|demo|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
