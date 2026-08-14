import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Reachable without a session. /auth/callback and /reset-password are used
// exactly when a session doesn't exist yet (email confirm) or only exists
// as a short-lived recovery session (password reset) — they must never be
// redirected away by the "no session -> /login" rule below.
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/api/signup",
];
// Bounce an already-authenticated visitor straight to /chat instead of
// showing them the login/signup form again.
const AUTH_ENTRY_PATHS = ["/login", "/signup"];
// "/" is the disguised ToDo screen and must always be reachable without the
// unlock cookie — it's what grants that cookie in the first place. Email
// links (confirmation, password reset) land on /auth/callback from outside
// the app, with no chance to have unlocked the disguise first, so it (and
// the /reset-password page it redirects into) must bypass the disguise gate
// too, same as they already bypass the session-required check below.
const DISGUISE_EXEMPT_PATHS = ["/", "/auth/callback", "/reset-password"];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The disguise gate is checked first, before anything auth-related: a
  // freshly (re)opened app/tab has no session cookie for it yet, since it's
  // a session cookie (no Max-Age) set only after typing today's date on the
  // ToDo screen. Anyone — logged in or not — gets sent back to "/" without
  // it, which is the whole point of the disguise.
  if (
    !DISGUISE_EXEMPT_PATHS.some((p) => pathname === p) &&
    !request.cookies.get("disguise_unlocked")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getSession() reads the JWT from the cookie locally — no network round
  // trip to the Auth server — unlike getUser(), which re-validates on every
  // call. That round trip on every single navigation is what made screen
  // transitions feel slow. This is safe here because this check only drives
  // a UX redirect; the real security boundary is Postgres RLS, which
  // independently (and always) validates the JWT on every data query.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // "/" must match exactly — startsWith("/") would match every path and
  // silently disable the auth-required redirect below entirely.
  const isPublicPath = PUBLIC_PATHS.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));

  if (!session && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && AUTH_ENTRY_PATHS.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  return response;
}
