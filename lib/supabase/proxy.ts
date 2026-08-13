import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // "/" is the disguised entry screen (looks like a to-do app) and must be
  // reachable without a session — it's what decides whether to reveal
  // /login at all, so it can't itself require auth or redirect on visit.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.next({ request });
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

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname.startsWith("/login");

  if (!session && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    return NextResponse.redirect(url);
  }

  return response;
}
