import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Reachable without a session. /auth/callback and /reset-password are used
// exactly when a session doesn't exist yet (email confirm) or only exists
// as a short-lived recovery session (password reset) — they must never be
// redirected away by the "no session -> /login" rule below.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"];
// Bounce an already-authenticated visitor straight to /chat instead of
// showing them the login/signup form again.
const AUTH_ENTRY_PATHS = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
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

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

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
