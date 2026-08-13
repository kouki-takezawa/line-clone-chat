# セットアップ手順

実際にデプロイした構成に合わせた手順です（当初案から一部変更しています：メール認証ではなくログインID方式、プッシュ通知は未実装、24時間TTLの実行はEdge Functionではなくpg_cron+SQL関数）。

## 1. Supabaseプロジェクト作成

1. https://supabase.com でプロジェクトを新規作成（無料枠、リージョンはTokyo推奨）。
2. Project Settings → API から `Project URL`・`anon public key`・`service_role key` を控える（service_role keyは絶対に公開しない）。
3. Project Settings → Database から接続文字列（Session Pooler推奨、`aws-0-<region>.pooler.supabase.com:6543`、ユーザー名`postgres.<project-ref>`）とデータベースパスワードを控える。

## 2. マイグレーション適用（Supabase CLIなし、直接Postgres接続）

Supabase CLIのログインはブラウザ認証が必要で非対話環境では使えないため、`supabase/migrations/*.sql` を直接Postgres接続で順番に適用する（`pg` パッケージ等でNode script化すると楽）。0001〜0009まで全て適用すること。

## 3. 管理者アカウントのbootstrap

Supabase Auth Admin API（service_role key使用）で最初の管理者アカウントを作成する:

```bash
curl -X POST "https://<project-ref>.supabase.co/auth/v1/admin/users" \
  -H "apikey: <service-role-key>" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "<好きなログインID>@login.internal",
    "password": "<初期パスワード（6文字以上）>",
    "email_confirm": true,
    "user_metadata": { "login_id": "<好きなログインID>", "display_name": "管理者", "is_admin": true }
  }'
```

以降の友達アカウントは、このアカウントでログイン後、設定画面から追加できる（最大5人）。

## 4. 24時間TTL purgeの有効化（Vault secret設定）

`purge_expired_messages()`（migration 0009）はStorage画像削除にservice_role keyを使うが、そのキー自体はマイグレーションファイルにはコミットされていない（git管理外）。SQL Editorで一度だけ実行する:

```sql
select vault.create_secret('<service-role-key>', 'service_role_key', 'Used by purge_expired_messages()');
```

これで `pg_cron` が15分ごとに `purge_expired_messages()` を実行し、設定画面で指定したTTL（デフォルト24時間）を過ぎたメッセージと画像を自動削除する。

## 5. Auth設定

Dashboard → Authentication → Settings → **「Allow new users to sign up」をOFF**にする（ログインID方式のため実質的に第三者は登録できないが、念のため）。

## 6. ローカル環境変数

`.env.local.example` を `.env.local` にコピーし、値を埋める:

```bash
cp .env.local.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 手順1で控えた値
- `SUPABASE_SERVICE_ROLE_KEY`: 手順1で控えたservice_role key（サーバー専用、`/api/admin/*` が使用。クライアントには公開されない）

## 7. Vercelへデプロイ

GitHubリポジトリをVercelにImportし、上記3つの環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`）をProject Settings → Environment Variablesに設定してDeploy。以降は`main`にpushするたび自動デプロイされる。

## 未実装（保留中）

- プッシュ通知（VAPID・Supabase Edge Function `send-push`・Database Webhook）。実装済みのUI（通知ON/OFFトグル）はあるが、実際の通知送信は未接続。
- `supabase/functions/purge-expired`（Edge Function版のTTL purge）は未使用。実際に動いているのはmigration 0009のSQL関数+pg_cron版。

## 動作確認: TTL自動削除

SQL Editorで特定メッセージを未来のTTLより古く見せかける:

```sql
update messages set created_at = now() - (select ttl_hours from settings where id = true) * interval '1 hour' - interval '1 minute' where id = '<message-id>';
select purge_expired_messages(); -- 手動実行、または最大15分待つ
```

削除後、そのメッセージがDB・Storageの両方から消え、開いている画面からもリアルタイムに消えることを確認する。
