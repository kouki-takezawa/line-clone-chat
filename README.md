# line-clone-chat

LINEに似たUIを持つ、最大100人規模を想定したコミュニティ向けチャットWebアプリ。**送信されたメッセージ・画像は送信から24時間経過後に自動的に完全削除され、ログを残さないプライベートな通信環境を提供する**ことを最大のコンセプトとする。

- 本番URL(メインアプリ): https://line-clone-chat.vercel.app/
- 本番URL(管理画面): https://line-clone-chat-zvcx.vercel.app/
- ホスティング: Vercel（Hobby, 無料枠。メインアプリ・管理画面は別プロジェクトとしてデプロイし、URLを分離）
- バックエンド: Supabase（Postgres / Auth / Realtime / Storage、無料枠。メインアプリ・管理画面で同一プロジェクトを共有）

> 課金安全設計・セキュリティ設計の詳細は [`SECURITY_AND_CAPACITY.md`](./SECURITY_AND_CAPACITY.md)、開発環境セットアップ手順は [`SETUP.md`](./SETUP.md) を参照。

---

## このリポジトリについて

個人開発によるフルスタックWebアプリで、実際にVercel + Supabaseの無料枠上で本番稼働している。LINEのDM機能を模した「送って終わり」のシンプルなチャットに絞り込みつつ、認証・Row Level Securityによる認可・Supabase Realtimeでの即時反映・`pg_cron`による定期バッチ処理・不正利用対策としてのDBトリガー・監査ログ付きの別建て管理画面など、実運用に耐える設計を一通り実装することを目的に作られている。単なる写経ではなく、「無料枠だけで100人規模のコミュニティを安全に運用する」という制約のもとで、課金安全設計・容量設計・セキュリティ設計を自分で検討し直した点が特徴（判断根拠は [`SECURITY_AND_CAPACITY.md`](./SECURITY_AND_CAPACITY.md) にまとめている）。

主な特徴を要約すると:

- **1:1チャット + Supabase Realtime**によるメッセージ・既読・リアクション・入力中インジケーターの即時反映
- **メッセージ・画像は送信から24時間で自動的に物理削除**（`pg_cron`が定期実行、ログを一切残さない設計）
- 誰でもメールアドレスで登録できるオープン設計だが、**登録上限110アカウント**・**送信レートリミット**（DBトリガー）で無料枠を超えないよう保護
- 友達コード/QRコードによる友達追加、申請の承認・拒否、ブロックはRLSレベルで強制
- 画像は圧縮の上、非公開Storageバケット + 5分間有効な署名付きURLで配信
- 一般ユーザーには管理者権限を持たせず、アカウント管理・利用制限・全体配信・不正監視用のトーク閲覧は**別URL・別ログインの管理画面（`admin/`）**に完全分離
- Web Pushによるプッシュ通知の実配信

グループチャット・音声通話・スタンプ・メッセージ検索など、LINE本家の機能のうち24時間TTL/小規模コミュニティという設計方針に合わないものは意図的にスコープ外としている（詳細は後述）。

---

## コンセプト

- 誰でもメールアドレスで自由に登録できる、LINEのようなオープンなコミュニティチャット（最大100人規模、登録上限110アカウント）
- 送信したメッセージ・画像は**送信から24時間で自動的にDB・Storageの両方から物理削除**される。既読ログなど、削除漏れの元になる余計な履歴も持たない設計
- 一般ユーザーに管理者権限の区別はなく、**全員が同じ設定画面・同じ機能にアクセスできる**。運営専用の操作（アカウント管理・制限・全体配信・トークの取り締まり閲覧）は、別URL・別ログインの管理画面（`admin/`）に完全分離している

---

## 実装済みの機能（メインアプリ）

### 認証・アカウント
- メールアドレス＋パスワードによる新規登録（`app/signup/page.tsx`）。Supabase DashboardのAuth設定に依存せず、Admin API経由で確認済みアカウントを作成しその場でログインさせる方式（`app/api/signup/route.ts`）
- パスワード忘れ・リセット（`app/forgot-password/page.tsx` / `app/reset-password/page.tsx`）
- パスワードは8文字以上必須
- 登録者数が110人に達すると新規登録を拒否（DBトリガーで強制）
- 退会（アカウント完全削除、`app/api/account/delete/route.ts`）

### 友達機能
- 友達コード・QRコードによる友達追加（`app/(tabs)/home/add/`）
- 友達申請の送信（ひとことメッセージ付き）・承認・拒否・取り消し（`app/(tabs)/home/requests/`）
- 友達の削除・ブロック（ブロックはメッセージ・友達申請の送受信自体をRLSレベルで拒否）
- 友達一覧の検索、個別プロフィール画面（`components/FriendProfile.tsx`、X/Instagramリンク表示）

### トーク・チャットUX
- 友達一覧（`/home`）・トーク一覧（`/chat`）・設定（`/settings`）の3タブ構成
- 1:1チャット。Supabase Realtimeでメッセージ・既読・リアクションを即時反映
- テキスト送信（複数行対応、1,000文字まで）、URL自動リンク化
- 画像送信（複数枚まとめて送信可、送信前にブラウザ側で圧縮、表示は5分間有効な署名付きURL経由）、タップで拡大表示（ライトボックス）
- 位置情報の共有（Google Mapsリンクをメッセージとして送信）
- メッセージの長押し/右クリックメニュー（コピー・自分の送信取消）、絵文字リアクション
- 入力中（タイピング）インジケーター（Supabase Realtime Broadcast）
- 既読表示、トークごとのミュート、未読件数バッジ、TTLまでの残り時間表示
- 送信中/送信失敗の視覚的フィードバック（オプティミスティックUI・再試行）
- トーク一覧の行はスワイプでピン留め・削除が可能。削除は自分の画面からのみの非表示操作
- プッシュ通知の実配信（`app/api/push/notify/route.ts`、Web Push）
- 送信済みメッセージ・画像は送信から24時間後、`pg_cron` が15分おきに実行する `purge_expired_messages()` によってDB・Storageの両方から物理削除される

### プロフィール・設定（`/settings`）
- 表示名・アバター画像の編集、X/Instagramハンドルの登録
- パスワード変更、通知設定（受信ON/OFF・本文プレビュー表示可否）
- ブロック中の友達の一覧・解除、削除した友達の復元
- 退会

### 容量・セキュリティ対策（無料枠運用の前提）
- DBトリガーによるレートリミット（同一送信者が1秒間に3通以上、または1分間に画像5枚以上、24時間で画像20枚以上を拒否）
- 画像は非公開Storageバケットに保存し、5分間有効な署名付きURLでのみ配信
- 全テーブルでRow Level Security (RLS) を有効化し、「自分が当事者のデータ」のみ参照・更新可能。ブロック・各種制限もRLS/トリガーで強制（UI非表示だけに依存しない）
- service role key・DB接続情報などの秘匿情報はサーバー環境変数（`server-only`パッケージでクライアントバンドル混入をビルドエラー化）にのみ保持し、gitには一切コミットしない

詳細な数値根拠・脅威モデルは [`SECURITY_AND_CAPACITY.md`](./SECURITY_AND_CAPACITY.md) を参照。

---

## 管理画面（`admin/`、別URL・別デプロイ）

メインアプリとは独立したNext.jsアプリ。同じGitHubリポジトリのサブディレクトリだが、Vercel上は別プロジェクト（Root Directory: `admin`）としてデプロイし、別URL・別ログインを持つ。

- **認証**: ユーザー名+パスワードの個別ログイン（`admin_users`テーブル、パスワードはNode標準の`scrypt`でハッシュ化。複数管理者を作成・削除可能）
- **アカウント管理**: 一覧（検索・フィルタ・列ソート）、個別詳細（プロフィール・友達数・トーク数）、表示名の変更、チェックボックスによる一括操作、CSVエクスポート
- **アカウント制限**（3種類、それぞれ独立に設定可能）
  - 全体制限: Supabase Authの`ban_duration`によるログイン自体の禁止（期間指定・理由記録つき）
  - 友達追加の制限: 友達申請の送信・承認をRLSレベルで禁止
  - トーク送信の制限: トーク画面の閲覧は可能なまま、メッセージ送信のみRLSレベルで禁止
- **トーク内容の閲覧**（違法行為の取り締まり目的）: 指定アカウントが参加している各トークの実際のメッセージ内容（テキスト・画像）を確認可能。閲覧のたびに監査ログへ記録
- **管理Bot経由の配信**: 全ユーザーに自動接続される「運営からのお知らせ」Botを使い、即時の全体配信・個別メッセージ送信・日時指定の予約配信（`pg_cron`で自動送信）が可能。Botのトークはユーザー側で常にトーク一覧の一番上に固定され、削除・ブロックはできない（RLS/トリガーで禁止）
- **統計**: 登録者数の推移グラフ、保持中メッセージ数・画像容量・プロフィール画像容量（Supabase無料枠の上限に対する目安）
- **監査ログ**: 制限・削除・改名・配信・トーク閲覧など、管理操作を「誰が・いつ・何を」行ったか記録

詳細は [`admin/`](./admin/) 以下のコード、DBスキーマは `supabase/migrations/0020`〜`0025` を参照。

---

## 意図的にスコープ外の機能

24時間TTL・小規模コミュニティという設計上、以下は意図的に未実装：

- グループチャット（データモデルが1:1前提のため、対応するなら別途大型フェーズが必要）
- 音声・ビデオ通話
- スタンプ、VOOM/タイムライン、LINE Pay、公式アカウント
- メッセージ検索（24h TTLのため不要）、バックアップ/復元

---

## 技術スタック

- **フレームワーク**: Next.js 16（App Router, Turbopack）。管理画面も同一バージョンの独立アプリ
- **バックエンド**: Supabase（Postgres, Auth, Realtime, Storage）。メインアプリ・管理画面で同一プロジェクトを共有し、管理画面はservice roleキーでRLSを経由せずアクセス
- **認証**: メインアプリ = Supabase Auth + `@supabase/ssr`（Cookieベースセッション）。管理画面 = 独自の`admin_users`テーブル + 署名付きセッションCookie（Supabase Authとは独立）
- **スタイリング**: Tailwind CSS
- **画像圧縮**: `browser-image-compression`（クライアント側）
- **マイグレーション適用**: Supabase CLIを使わず、Session Pooler経由の直接Postgres接続で適用（`supabase/migrations/*.sql`、0001〜0025）
- **24時間自動削除・予約配信**: `pg_cron`（Postgres拡張機能。Supabase Edge Functionは使用しない）

---

## ディレクトリ構成（抜粋）

```
app/
  (tabs)/              # ボトムタブ配下の画面（home / chat / settings）と共通レイアウト
  api/                 # signup / avatar / account / push など、サーバー側処理が必要なルート
  login/ signup/ forgot-password/ reset-password/
  chat/[roomId]/       # 個別トーク画面（タブの外、全画面表示）
components/
  ChatRoom.tsx MessageList.tsx MessageBubble.tsx Composer.tsx
  FriendList.tsx HomeFriendList.tsx FriendProfile.tsx SwipeableRow.tsx
  SettingsPanel.tsx MyProfile.tsx SnsLinks.tsx
lib/
  supabase/            # client.ts(ブラウザ) / server.ts(SSR) / admin.ts(service role) / proxy.ts
  types.ts rooms.ts roomMemberActions.ts push-client.ts
supabase/migrations/   # 0001〜0025、直接Postgres接続で順番に適用

admin/                 # 管理画面（別Next.jsアプリ、別Vercelプロジェクトとしてデプロイ）
  app/(dashboard)/     # ダッシュボード・アカウント詳細・トーク閲覧・全体配信・統計・監査ログ
  app/api/             # アカウント操作・配信・管理者管理などのAPIルート
  lib/adminAuth.ts lib/passwordHash.ts lib/supabaseAdmin.ts
```

---

## データベース概要（抜粋）

| テーブル | 役割 |
|---|---|
| `profiles` | ユーザープロフィール。`is_system_bot`（運営Botフラグ）、`friend_requests_restricted`/`messaging_restricted`（個別制限）を含む |
| `rooms` / `room_members` | 1:1チャットルームと参加者。`pinned`・`talk_hidden`・`friend_removed`・`muted`・`last_read_at` を保持 |
| `messages` / `message_reactions` | メッセージ本文・画像パス・リアクション。24時間後に物理削除される |
| `friend_requests` / `blocks` | 友達申請とブロック |
| `push_subscriptions` | プッシュ通知の購読情報 |
| `admin_users` | 管理画面の個別ログイン（ユーザー名 + scryptハッシュ） |
| `admin_audit_log` | 管理操作の監査ログ |
| `scheduled_broadcasts` | 予約配信（`pg_cron`が1分ごとに確認し自動送信） |

RLSは全テーブルで有効。詳細なポリシーは各migrationファイルを参照。

---

## 開発

### メインアプリ

```bash
npm install
cp .env.local.example .env.local   # Supabaseの接続情報を設定
npm run dev
```

### 管理画面

```bash
cd admin
npm install
cp .env.local.example .env.local   # メインアプリと同じSupabase接続情報 + ADMIN_SESSION_SECRET
npm run dev   # http://localhost:3001
```

- 型チェック: `npx tsc --noEmit`
- Lint: `npm run lint`
- ビルド: `npm run build`

（それぞれ `admin/` に移動して同じコマンドを実行すれば管理画面側も検証できる）

Supabaseプロジェクトの初期構築・マイグレーション適用手順は [`SETUP.md`](./SETUP.md) を参照。
