# hirakawa プロジェクト 3責務分離ドキュメント

本ドキュメントは、プロジェクトの責務を **「01-production（本番サイト）」「02-preview（AI Studioプレビュー）」「03-external（外部）」** の3つに明確に分離・整理した構成および依存関係の調査結果をまとめたものです。

---

## 1. ディレクトリ構成概要

```text
hirakawa-separated/
├── 01-production/             # 実際のサイト（本番機能）
│   ├── index.html             # 本番用原稿エディタ・グリッド・UI・同期UI
│   ├── supabase-client.js     # Supabaseクライアント認証・データ同期モジュール
│   ├── package.json           # 本番依存定義
│   └── README.md              # 本番機能仕様書
├── 02-preview/                # AI Studioプレビュー & レイアウト検証
│   ├── preview-tester.html    # マルチ列数（18〜40文字）表示検証ハーネス
│   ├── preview-config.json    # プレビュー画面幅・検証ルール定義
│   └── preview-validator.js   # 動的計算・最小高さ・フォント同期検証スクリプト
├── 03-external/               # 外部サービス・インフラ・依存関係
│   ├── supabase-schema.sql    # Supabase側 PostgreSQL テーブル定義 & RLSポリシー
│   ├── external-dependencies.json # 外部CDN・API・フォント定義
│   └── env.config.md          # 外部エンドポイント & 認証仕様
└── README.md                  # 本統合レポート
```

---

## 2. 3つの責務の所属ファイルと役割一覧

| 領域 | ファイル | 役割 | 依存方向 |
|---|---|---|---|
| **01-production** | `index.html`<br>`supabase-client.js`<br>`package.json` | ユーザーが実際に操作する執筆エディタ、マス目描画、文字数カウント、データ保存、設定モーダル、Supabaseとの接続クライアント | External（CDN/API）を参照。<br>Previewは一切参照しない。 |
| **02-preview** | `preview-tester.html`<br>`preview-config.json`<br>`preview-validator.js` | AI Studioおよび異なる端末サイズ・文字数（18〜40字）での表示崩れ検証。本番設定を汚染しないサンドボックス | Productionを表示対象として読み込むが、Production側の状態（localStorage等）は改変しない。 |
| **03-external** | `supabase-schema.sql`<br>`external-dependencies.json`<br>`env.config.md` | クラウドDB（Supabase）側のテーブル構造・RLS定義、外部CDN（jsDelivr）、OSフォント | 独立した外部インフラ・スキーマ定義。 |

---

## 3. 依存関係と境界の検証結果

### ① ProductionからPreviewを参照していないか
- **確認結果**: 参照していません。
- **詳細**: `01-production/index.html` には、プレビュー用のモックコード、特定幅決め打ちの処理、またはPreviewテスター用スクリプトのインポートは一切含まれていません。本番エディタは独立して動作可能です。

### ② ProductionからExternalへどのように接続しているか
- **確認結果**: 安全なクライアントSDK（CDN経由 `@supabase/supabase-js@2`）を使用し、Public Anon Key と RLS（Row Level Security）によってユーザーごとに分離接続されています。
- **接続経路**:
  1. ブラウザがCDNからSupabase JSクライアントをロード
  2. `SUPABASE_PROJECT_URL`（`https://eqzyrsziwgmlanmztivu.supabase.co`）へHTTPS経由で認証・クエリ実行
  3. 未ログイン時やオフライン時は自動的に `localStorage` のローカル保存へフォールバックし、原稿の安全性を確保。

### ③ PreviewがProductionの設定値や状態を変更していないか
- **確認結果**: 変更していません。
- **詳細**: Previewハーネス（`preview-tester.html`）は、独立したiframe内で表示確認を行い、検証用操作が本番のユーザーデータ（`n_d`, `n_w` など）を恒久的に書き換えないように隔離されています。

### ④ Supabase関連コードの責務分離
- **Production側（01-production）**:
  - `initSupabaseAuth()`: ログイン/サインアップモーダル、セッション監視
  - `syncDataToCloud()` / `pullDataFromCloud()`: 原稿データと設定の同期リクエスト
- **External側（03-external）**:
  - `user_stories` / `user_settings` テーブル定義（PostgreSQL DDL）
  - RLS セキュリティポリシー（`auth.uid() = user_id`）
  - 外部プロジェクトエンドポイント・インフラ仕様

### ⑤ 3領域で共有しているコードの有無
- **共有コード**: なし（ゼロ共有）。
  - 設定値や計算ロジックはそれぞれの責務内で完結させており、混同を防ぐ構造に統一しています。

---

## 4. 「30文字」に関する全箇所の調査結果

コードベース内で「30」という値が使用されている全箇所を精査した結果は以下の通りです：

| 対象箇所 | コード内容 | 分類 | 調査結果・動作検証 |
|---|---|---|---|
| **初期選択肢** | `l.innerHTML+=...; l.value="30";` | デフォルト初期値 | 初回アクセス時にドロップダウンの初期選択値を30に設定しているのみ。固定値ではない。 |
| **全体文字数フォールバック** | `function getGlobalCols(){ ... return 30; }` | 安全用フォールバック | `localStorage` に保存された設定値（`n_w`）が存在しない場合のデフォルト値。ユーザーが設定変更（例：20字や28字）した場合はその値が返る。 |
| **表示更新フォールバック** | `let cols = getActiveCols(f) : 30;` | 安全用フォールバック | 現在の原稿に `customCols` が指定されていればその値を優先し、未指定時はグローバル値、それでも取得できない場合の保護値。 |
| **モーダル保存フォールバック** | `let val = sel ? parseInt(sel.value) : 30;` | 入力バリデーション | 不正な入力（NaNや18未満/100超）があった場合の保護値。 |
| **初期値リセットボタン** | `resetColsModalDefault()` | ユーザー明示的操作 | 設定モーダル内の「初期値(30文字)に戻す」ボタンを押下した時のみ呼び出されるリセット処理。 |
| **スナップショット保存** | `sw: (l ? l.value : '30')` | フォールバック | クラウド同期用スナップショット作成時の保護値。 |
| **その他（非文字数）** | 30ms, 300ms, 3000ms | タイマー遅延 | デバウンス処理およびZIPファイルヘッダ（30 bytes）、30px高さなど（文字数とは無関係）。 |

### 結論：
1. **30は単なるデフォルト値（初期値）** であり、レイアウト計算の基準値や固定値としては使われていません。
2. グリッドのセルサイズ（`--cs`）やコンテナ幅は、`getActiveCols(f)` により **18〜40文字（最大100文字）に完全動的追従** します。
3. ユーザーが29、28、25、18字等に変更した後に、システムが勝手に30へ戻す処理は存在しません（明示的な「初期値に戻す」ボタン押下時のみ）。
4. Preview用の30文字のレイアウト調整がProductionの計算式を歪める混入はありません。

---

## 5. 分離前後の構成比較

| 項目 | 分離前 | 分離後 |
|---|---|---|
| **責務管理** | 単一の `index.html` 内に本番機能・外部Supabase設定・プレビュー確認用の記述が混在 | `01-production`, `02-preview`, `03-external` の3ディレクトリに明確に分離 |
| **Supabase仕様** | コード内の文字列定義のみ | `03-external/supabase-schema.sql` にDDL・RLSを明文化し、`01-production/supabase-client.js` でクライアント責務を整理 |
| **プレビュー検証** | 本番画面での直接確認のみ | `02-preview/preview-tester.html` にてマルチデバイス・マルチ列数の検証環境を整備 |
| **30文字の透明性** | デフォルト値とレイアウト制約の境界が不明確 | 30文字が純粋な初期デフォルト値であり動的対応していることを検証・記録 |
| **既存機能・互換性** | 既存データ・同期・UIが稼働 | **完全維持（破壊的変更ゼロ、データ・設定値保全）** |
