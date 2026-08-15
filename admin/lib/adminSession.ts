import "server-only";
import { cookies } from "next/headers";
import { getSessionUsername, SESSION_COOKIE } from "@/lib/adminAuth";

// Route Handlers / Server Components only — next/headers' cookies() needs
// request-scoped context that isn't available in the Edge Middleware
// runtime, which is why this stays out of lib/adminAuth.ts (imported by
// proxy.ts).
export async function getCurrentAdminUsername(): Promise<string | null> {
  const store = await cookies();
  return getSessionUsername(store.get(SESSION_COOKIE)?.value);
}
