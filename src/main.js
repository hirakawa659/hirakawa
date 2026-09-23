/**
 * アプリケーション統合エントリーポイント
 *
 * 【重要な設計ルール】
 * index.html 内のインラインスクリプトが「現在実際に動いている本体」であり、
 * 文字数カウント・マス目描画(z/v/ensureGridLines)・貼り付け後の整形(scheduleHeavyTask 等)は
 * すべてインライン側の実装が最新です。
 *
 * 以前はここで Object.assign(window, ...) によりモジュール版の“簡易コピー”が
 * インライン側の関数を丸ごと上書きしていました。これが
 *   ・文字数ボタン(22文字)が反映されない（getGlobalCols が 22 を 20 に戻す）
 *   ・長文貼り付け後にマス目整形・保存が走らない（scheduleHeavyTask の引数仕様が違う）
 *   ・文字数がカウントされない（存在しない #c に書き込む v()）
 *   ・タブ復帰時に画面がカタカタする（スクロール補正の無い z()）
 * の根本原因でした。
 *
 * そのため、
 *   1) すでにインライン側で定義済みの関数名は絶対に上書きしない
 *   2) モジュール側にしか無い関数（競合モーダル、安全スナップショット等）だけを補完する
 *   3) クラウド認証・同期 (auth.js / sync.js) はモジュール版を正とする（競合検知付きのため）
 * というルールにしています。
 */
import * as TextUtils from './utils/text.js';
import * as DomUtils from './utils/dom.js';
import * as Storage from './data/storage.js';
import * as Migration from './data/migration.js';
import * as Backup from './data/backup.js';
import * as Auth from './cloud/auth.js';
import * as Sync from './cloud/sync.js';
import * as Trash from './management/trash.js';
import * as Documents from './management/documents.js';
import * as Grid from './editor/grid.js';
import * as Cursor from './editor/cursor.js';
import * as Editor from './editor/editor.js';
import * as Settings from './ui/settings.js';
import * as Dialogs from './ui/dialogs.js';

// 状態変数は export let のスナップショットになってしまい古い値が残るため、window へは公開しない
const STATE_KEYS = new Set([
    'd', 'f', 'pId',
    'historyStack', 'historyIndex',
    'currentSearchIndex', 'currentSearchResults',
    'currentUser', 'supabaseClient', 'currentSyncTab', 'isPasswordRecoveryMode',
    'cloudSyncTimeout', 'lastSyncTimestamp', 'pendingConflictData'
]);

// モジュール版を正として上書きしてよいグループ（クラウド認証・同期）
const MODULE_WINS_GROUPS = [Auth, Sync];

// インライン側の実装を優先し、無いものだけ補完するグループ
const FILL_ONLY_GROUPS = [
    TextUtils, DomUtils, Storage, Migration, Backup,
    Trash, Documents, Grid, Cursor, Editor, Settings, Dialogs
];

function exposeToWindow() {
    if (typeof window === 'undefined') return;

    // (1) 補完のみ：window にすでに存在する名前（=インライン関数宣言）は触らない
    for (const group of FILL_ONLY_GROUPS) {
        for (const [key, value] of Object.entries(group)) {
            if (STATE_KEYS.has(key)) continue;
            if (key in window) continue;
            try {
                window[key] = value;
            } catch (err) {
                console.warn('[main.js] window への公開に失敗:', key, err);
            }
        }
    }

    // (2) クラウド系はモジュール版を採用（関数のみ。状態変数は公開しない）
    for (const group of MODULE_WINS_GROUPS) {
        for (const [key, value] of Object.entries(group)) {
            if (STATE_KEYS.has(key)) continue;
            if (typeof value !== 'function') continue;
            try {
                window[key] = value;
            } catch (err) {
                console.warn('[main.js] window への公開に失敗:', key, err);
            }
        }
    }
}

exposeToWindow();

export {
    TextUtils,
    DomUtils,
    Storage,
    Migration,
    Backup,
    Auth,
    Sync,
    Trash,
    Documents,
    Grid,
    Cursor,
    Editor,
    Settings,
    Dialogs
};
