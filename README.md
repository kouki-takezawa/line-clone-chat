# line-clone-chat

LINEに似たUIを持つ、最大100人規模を想定したコミュニティ向けチャットWebアプリ。**送信されたメッセージ・画像は送信から24時間経過後に自動的に完全削除され、ログを残さないプライベートな通信環境を提供する**ことを最大のコンセプトとする。

- 本番URL: https://line-clone-chat.vercel.app/
- ホスティング: Vercel（Hobby, 無料枠）
- バックエンド: Supabase（Postgres / Auth / Realtime / Storage、無料枠）

> 課金安全設計・セキュリティ設計の詳細は [`SECURITY_AND_CAPACITY.md`](./SECURITY_AND_CAPACITY.md)、開発環境セットアップ手順は [`SETUP.md`](./SETUP.md) を参照。

---

## コンセプト

- 誰でもメールアドレスで自由に登録できる、LINEのようなオープンなコミュニティチャット（最大100人規模、登録上限110アカウント）
- 送信したメッセージ・画像は**送信から24時間で自動的にDB・Storageの両方から物理削除**される。既読ログなど、削除漏れの元になる余計な履歴も持たない設計
- 管理者と一般ユーザーの区別はない。**全員が同じ設定画面・同じ機能にアクセスできる**（従来あった「管理者だけが友達を管理する」招待制モデルは廃止済み）

---

## 実装済みの機能（フェーズ1: 認証基盤）

### 認証・アカウント
- メールアドレス＋パスワードによる新規登録（[`app/signup/page.tsx`](./app/signup/page.tsx)）。登録時に表示名も入力
- メール確認必須。確認リンクは [`app/auth/callback/route.ts`](./app/auth/callback/route.ts) で処理し、認証完了後に自動ログイン
- パスワード忘れ・リセット（[`app/forgot-password/page.tsx`](./app/forgot-password/page.tsx) / [`app/reset-password/page.tsx`](./app/reset-password/page.tsx)、メールリンク経由）
- パスワードは8文字以上必須（クライアント側検証）
- 登録者数が110人に達すると新規登録を拒否（DBトリガーで強制、`supabase/migrations/0012_open_registration.sql`）
- ログイン状態は `@supabase/ssr` によるCookieセッションで管理。未ログイン時は自動的に `/login` へ、ログイン中に `/login` `/signup` へアクセスすると `/chat` へリダイレクト（[`lib/supabase/proxy.ts`](./lib/supabase/proxy.ts)）

### プロフィール・設定（`/settings`、全ユーザー共通）
- 表示名の編集
- アバター画像のアップロード（[`components/SettingsPanel.tsx`](./components/SettingsPanel.tsx)。ブラウザ側で圧縮後、[`app/api/avatar/route.ts`](./app/api/avatar/route.ts) 経由でアップロード。パスは認証済みセッションから決定するため、クライアントから偽装不可）。未設定時は絵文字アイコン（[`components/Avatar.tsx`](./components/Avatar.tsx)）
- パスワード変更
- 通知のON/OFF切り替え（[`components/NotificationToggle.tsx`](./components/NotificationToggle.tsx)。※実際のプッシュ配信は未実装、トグルの保存のみ）
- メッセージ自動削除までの時間（現在24時間固定）の案内表示
- ログアウト

「設定」タブは以前は管理者専用だったが、廃止して**全ユーザーに表示**するよう変更済み。

### トーク・友達一覧
- 友達一覧（`/home`）・トーク一覧（`/chat`）・設定（`/settings`）の3タブ構成（[`components/BottomTabBar.tsx`](./components/BottomTabBar.tsx)）
- 1:1チャット（[`components/ChatRoom.tsx`](./components/ChatRoom.tsx)）。Supabase Realtimeでメッセージを即時反映
- テキスト送信（1,000文字まで、クライアント側`maxLength`とDB側`check`制約の二重制限）
- 画像送信（送信前にブラウザ側で圧縮、目標200KB以下。表示は5分間有効な署名付きURL経由）
- トーク一覧の行はスワイプでピン留め・削除が可能（[`components/SwipeableRow.tsx`](./components/SwipeableRow.tsx)）。**削除は自分の画面からのみ非表示になる操作**であり、相手の画面や実データには影響しない（`room_members.talk_hidden`を自分の行だけ更新）
- 送信済みメッセージ・画像は送信から24時間後、`pg_cron` が15分おきに実行する `purge_expired_messages()` によってDB・Storageの両方から物理削除される（この削除だけは両者の画面から消える正真正銘のハード削除）

### 容量・セキュリティ対策（無料枠運用の前提）
- DBトリガーによるレートリミット: 同一送信者が1秒間に3通以上、または1分間に画像5枚以上送ろうとすると`INSERT`を拒否（`enforce_message_rate_limit()`、APIを直接叩く迂回にも対応）
- 画像は非公開Storageバケットに保存し、5分間有効な署名付きURLでのみ配信
- 全テーブルでRow Level Security (RLS) を有効化し、「自分が当事者のデータ」のみ参照・更新可能
- service role key・DB接続情報などの秘匿情報はサーバー環境変数（`server-only`パッケージでクライアントバンドル混入をビルドエラー化）またはSupabase Vaultにのみ保持し、gitには一切コミットしない

詳細な数値根拠・脅威モデルは [`SECURITY_AND_CAPACITY.md`](./SECURITY_AND_CAPACITY.md) を参照。

---

## 未実装・今後の実装予定（フェーズ2〜4）

現時点ではまだ**友達申請の仕組みがない**ため、チャットルームはテストデータとして手動作成したもののみが存在する。以下は計画済みだが未着手の機能。

### フェーズ2: 友達申請・QRコード機能
- 検索用の友達コード（`profiles.friend_code`）
- 友達申請の送信・承認・拒否（`friend_requests`テーブル）
- ブロック機能（`blocks`テーブル、RLSレベルで送信自体を拒否）
- QRコードによる友達追加（生成: `qrcode`、読み取り: `jsQR`）

### フェーズ3: チャットUXの強化
- 画像タップでの拡大表示（ライトボックス）
- メッセージの長押し/右クリックメニュー（コピー・送信取消）
- 下スクロール（新着メッセージへ移動）ボタン
- 絵文字リアクション
- 入力中（Typing…）インジケーター（Supabase Realtime Broadcast使用）
- メッセージごとの削除までの残り時間表示
- 送信中/送信失敗の視覚的フィードバック（半透明表示・再試行ボタン）

### フェーズ4: 既読・ミュート・プッシュ通知の実配信
- 既読表示（`room_members.last_read_at`の比較のみで判定、既読ログは持たない設計）
- トークごとのミュート設定
- トーク一覧の未読件数バッジ
- プッシュ通知の実配信（`app/api/push/notify/route.ts`、`web-push`パッケージ、Vercel API Routeとして実装しSupabase Edge Function化を避ける）

---

## 技術スタック

- **フレームワーク**: Next.js 16（App Router, Turbopack）
- **バックエンド**: Supabase（Postgres, Auth, Realtime, Storage）
- **認証**: Supabase Auth + `@supabase/ssr`（Cookieベースセッション、`sameSite=lax`）
- **スタイリング**: Tailwind CSS
- **画像圧縮**: `browser-image-compression`（クライアント側）
- **マイグレーション適用**: Supabase CLIを使わず、Session Pooler経由の直接Postgres接続で適用（`supabase/migrations/*.sql`）
- **24時間自動削除**: `pg_cron` + `pg_net`（Postgres拡張機能。Supabase Edge Functionは使用しない）

---

## ディレクトリ構成（抜粋）

```
app/
  (tabs)/            # ボトムタブ配下の3画面（home / chat / settings）と共通レイアウト
  api/avatar/         # アバター画像アップロード用サーバールート
  auth/callback/       # メール確認・パスワードリセットのコールバック
  login/ signup/ forgot-password/ reset-password/
  chat/[roomId]/       # 個別トーク画面（タブの外、全画面表示）
components/
  Avatar.tsx           # 共通アバター表示（画像 or 絵文字）
  BottomTabBar.tsx
  ChatRoom.tsx MessageList.tsx MessageBubble.tsx Composer.tsx
  FriendList.tsx HomeFriendList.tsx SwipeableRow.tsx
  SettingsPanel.tsx NotificationToggle.tsx
lib/
  supabase/            # client.ts(ブラウザ) / server.ts(SSR) / admin.ts(service role) / proxy.ts
  types.ts             # DBスキーマの型定義
  image.ts             # 画像圧縮
supabase/migrations/   # 0001〜0012、直接Postgres接続で順番に適用
```

---

## データベース概要

| テーブル | 役割 |
|---|---|
| `profiles` | ユーザープロフィール（表示名・アバター）。`auth.users`作成時にトリガーで自動生成 |
| `rooms` / `room_members` | 1:1チャットルームと参加者。`pinned`（ピン留め）・`talk_hidden`（自分だけの非表示フラグ）を保持 |
| `messages` | メッセージ本文・画像パス。24時間後に物理削除される |
| `settings` | TTL時間などのグローバル設定（現状`ttl_hours=24`固定、編集UIはなし） |
| `push_subscriptions` | プッシュ通知用購読情報（フェーズ4で使用予定、テーブルのみ先行作成済み） |

RLSは全テーブルで有効。詳細なポリシーは各migrationファイルを参照。

---

## 開発

```bash
npm install
cp .env.local.example .env.local   # Supabaseの接続情報を設定
npm run dev
```

- 型チェック: `npx tsc --noEmit`
- Lint: `npm run lint`
- ビルド: `npm run build`

Supabaseプロジェクトの初期構築・マイグレーション適用手順は [`SETUP.md`](./SETUP.md) を参照。
