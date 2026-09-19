# 03-EXTERNAL: 外部設定および接続仕様

## 1. 外部接続先一覧

| 外部サービス | 接続先URL / リソース | 役割 |
|---|---|---|
| **Supabase Project** | `https://eqzyrsziwgmlanmztivu.supabase.co` | 認証エンドポイント・PostgreSQL DB・REST API (PostgREST) |
| **Supabase Client SDK** | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` | クライアント側でSupabaseと接続するためのCDNスクリプト |
| **Service Worker** | `/public/sw.js` | ブラウザのオフライン実行・キャッシュ管理 |

## 2. Supabase 接続仕様（クライアント側）

- **認証方式**: JWT Bearer Token (Supabase Auth)
- **公開鍵（ANON PUBLIC KEY）**:
  - クライアント側（ブラウザ）から安全に接続するためにPostgreSQLのRLS（Row Level Security）によって保護されたAnonキーを使用。
  - すべてのアクセスは `auth.uid() = user_id` のポリシーによってユーザーごとに厳密に隔離されます。
- **データテーブル**:
  - `public.user_stories`: 原稿データ（タイトル、本文、文字数、フォルダID、個別文字数設定 `customCols` など）およびフォルダツリー
  - `public.user_settings`: 全体設定（デフォルト文字数 `n_w`、ツールバー配置、テーマ設定等）

## 3. 責務の分離境界

- **External（本ディレクトリ）**:
  - 外部のサーバー環境、スキーマ定義、CDNリソース定義、セキュリティルール（RLS）
- **Production（01-production）**:
  - 外部サービスへ実際に接続するクライアントコード（ログインUI、データ同期ロジック、エラーハンドリング、ローカルストレージとの相互同期）
