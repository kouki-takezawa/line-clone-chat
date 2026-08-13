# セットアップ手順

実際にデプロイした構成に合わせた手順です（プッシュ通知は未実装、24時間TTLの実行はEdge Functionではなくpg_cron+SQL関数）。

認証はメールアドレス＋パスワードによる自己登録方式（誰でも`/signup`から登録可能、上限110アカウント）。以前のログインID・管理者招待方式は廃止済み。

## 1. Supabaseプロジェクト作成

1. https://supabase.com でプロジェクトを新規作成（無料枠、リージョンはTokyo推奨）。
2. Project Settings → API から `Project URL`・`anon public key`・`service_role key` を控える（service_role keyは絶対に公開しない）。
3. Project Settings → Database から接続文字列（Session Pooler推奨、`aws-0-<region>.pooler.supabase.com:6543`、ユーザー名`postgres.<project-ref>`）とデータベースパスワードを控える。

## 2. マイグレーション適用（Supabase CLIなし、直接Postgres接続）

Supabase CLIのログインはブラウザ認証が必要で非対話環境では使えないため、`supabase/migrations/*.sql` を直接Postgres接続で順番に適用する（`pg` パッケージ等でNode script化すると楽）。0001〜0012まで全て適用すること。

## 3. Auth設定・動作確認

Dashboard → Authentication → Settings → 「**Allow new users to sign up**」がONになっていることを確認する（誰でも登録できるオープンなアプリのため）。

無料枠のSupabase組み込みメール送信は送信数がかなり少なく、動作確認中もすぐレート制限にかかる。100人規模の登録・パスワードリセットメールを問題なく捌くには、Dashboard → Authentication → SMTP Settings で**カスタムSMTP（例: Resendの無料枠 月3,000通）の設定を推奨**する。

## 4. 24時間TTL purgeの有効化（Vault secret設定）

`purge_expired_messages()`（migration 0009）はStorage画像削除にservice_role keyを使うが、そのキー自体はマイグレーションファイルにはコミットされていない（git管理外）。SQL Editorで一度だけ実行する:

```sql
select vault.create_secret('<service-role-key>', 'service_role_key', 'Used by purge_expired_messages()');
```

これで `pg_cron` が15分ごとに `purge_expired_messages()` を実行し、設定画面で指定したTTL（デフォルト24時間）を過ぎたメッセージと画像を自動削除する。

## 5. ローカル環境変数

`.env.local.example` を `.env.local` にコピーし、値を埋める:

```bash
cp .env.local.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 手順1で控えた値
- `SUPABASE_SERVICE_ROLE_KEY`: 手順1で控えたservice_role key（サーバー専用。`/api/avatar` がアバターアップロード時に使用。クライアントには公開されない）

## 6. Vercelへデプロイ

GitHubリポジトリをVercelにImportし、上記3つの環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`）をProject Settings → Environment Variablesに設定してDeploy。以降は`main`にpushするたび自動デプロイされる。

## 未実装（保留中）

- 友達申請・QRコードによる友達追加（フェーズ2で実装予定。現状チャットルームは手動で作成したものしか存在しない）
- 画像ライトボックス・メッセージ長押しメニュー・絵文字リアクション・入力中インジケーターなどのチャットUX強化（フェーズ3）
- 既読表示・ミュート・未読バッジ・プッシュ通知の実配信（フェーズ4）。通知ON/OFFトグルのUIはあるが、実際の送信は未接続
- `supabase/functions/purge-expired`（Edge Function版のTTL purge）は未使用。実際に動いているのはmigration 0009のSQL関数+pg_cron版

## 動作確認: TTL自動削除

SQL Editorで特定メッセージを未来のTTLより古く見せかける:

```sql
update messages set created_at = now() - (select ttl_hours from settings where id = true) * interval '1 hour' - interval '1 minute' where id = '<message-id>';
select purge_expired_messages(); -- 手動実行、または最大15分待つ
```

削除後、そのメッセージがDB・Storageの両方から消え、開いている画面からもリアルタイムに消えることを確認する。

## 動作確認: 登録上限・レートリミット

登録者数110人到達時の拒否、および1秒3通/1分5枚のレートリミットはDBトリガー（migration 0012）で強制されており、Supabaseの管理画面でService Role KeyのREST API経由で直接インサートを連投することで動作確認できる（通常のUI操作では到達しない領域のため）。
