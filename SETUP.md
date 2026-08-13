# セットアップ手順

## 1. Supabaseプロジェクト作成

1. https://supabase.com でプロジェクトを新規作成（無料枠）。
2. Project Settings → API から `Project URL` と `anon public key` を控える。
3. Project Settings → API → `service_role key` を控える（**絶対に公開しない**）。

## 2. Supabase CLIでリンク & マイグレーション適用

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

これで `supabase/migrations/*.sql` が全て適用され、テーブル・RLS・Storageバケット・Realtimeが有効になります。

## 3. Auth設定

1. Dashboard → Authentication → Settings → **「Allow new users to sign up」をOFF**にする。
2. Authentication → Users → **Add user** で、参加者（最大3人）分のアカウントをメール+仮パスワードで作成する。

## 4. ルームとメンバーをSeed

SQL Editorで以下を実行（`<user-id-1>`等は作成したユーザーのUUID。Authentication → Usersの一覧から確認できます）:

```sql
insert into public.rooms (id, name) values (gen_random_uuid(), 'Family Chat') returning id;
-- 上のクエリで返ってきたidを使って:
insert into public.room_members (room_id, user_id) values
  ('<room-id>', '<user-id-1>'),
  ('<room-id>', '<user-id-2>'),
  ('<room-id>', '<user-id-3>');
```

## 5. VAPIDキー生成（プッシュ通知用）

```bash
npx web-push generate-vapid-keys
```

出力された Public Key / Private Key を控える。

## 6. Edge Functionsのデプロイとsecrets設定

```bash
npx supabase functions deploy purge-expired --no-verify-jwt
npx supabase functions deploy send-push --no-verify-jwt

npx supabase secrets set \
  SUPABASE_URL=https://<project-ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
  FUNCTION_SECRET=<好きなランダム文字列> \
  VAPID_SUBJECT=mailto:<自分のメールアドレス> \
  VAPID_PUBLIC_KEY=<上で生成したPublic Key> \
  VAPID_PRIVATE_KEY=<上で生成したPrivate Key>
```

## 7. cronとWebhookトリガーの設定

`supabase/post_deploy.sql` を開き、`<PROJECT_REF>` と `<FUNCTION_SECRET>`（手順6と同じ値）を置換してから、SQL Editorで実行する。これで:
- `purge-expired` が15分ごとに自動実行される（24時間TTL）
- メッセージが送信されるたびに `send-push` が自動的に呼ばれる

## 8. ローカル環境変数

`.env.local.example` を `.env.local` にコピーし、値を埋める:

```bash
cp .env.local.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 手順1で控えた値
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: 手順5で生成したPublic Key

## 9. ローカルで動作確認

```bash
npm run dev
```

2つの別ブラウザ（通常+シークレットウィンドウなど）で、手順3で作った別々のアカウントでログインし、テキスト・画像の送受信、通知トグルの動作を確認する。

## 10. Vercelへデプロイ

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY
npx vercel --prod
```

デプロイ後のURLと、手順3で発行した各自のログイン情報を、参加者にLINE等で個別に伝える。

## 24時間TTLの動作確認

SQL Editorで特定メッセージを25時間前に見せかける:

```sql
update messages set created_at = now() - interval '25 hours' where id = '<message-id>';
```

最大15分待つ（または `npx supabase functions invoke purge-expired` で手動実行）と、そのメッセージがDBからもStorageからも削除され、開いている画面からもリアルタイムに消えることを確認する。
