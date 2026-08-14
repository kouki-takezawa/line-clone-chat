import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_PASSWORD_LENGTH = 8;

// Registration goes through the Admin API instead of the regular
// auth.signUp() flow specifically to create accounts pre-confirmed
// (email_confirm: true) — Supabase's free-tier mailer can't reliably
// deliver confirmation emails at any real volume, and this project's
// dashboard doesn't expose a "skip confirmation" toggle to work around
// it any other way. This is the same mechanism used to manually create
// confirmed accounts earlier in this project's life, just automated.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!email || !displayName) {
    return NextResponse.json({ error: "入力内容を確認してください" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error || !data.user) {
    const message = error?.message ?? "";
    const friendly =
      message.includes("already registered") || message.includes("already been registered")
        ? "このメールアドレスは既に登録されています"
        : message.includes("registration limit")
          ? "現在、新規登録の上限に達しています"
          : "登録に失敗しました";
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  // createUser() only creates the account — it doesn't establish a
  // session. Signing in here, through the cookie-writing request-scoped
  // client, is what actually logs the browser in.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    return NextResponse.json(
      { error: "登録は完了しましたが、自動ログインに失敗しました。ログイン画面からお試しください" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
