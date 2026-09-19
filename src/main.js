/**
 * アプリケーション統合エントリーポイント
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

// グローバル window への安全なマッピング（HTML内のインラインイベントハンドラ互換性保持）
Object.assign(window, {
    ...TextUtils,
    ...DomUtils,
    ...Storage,
    ...Migration,
    ...Backup,
    ...Auth,
    ...Sync,
    ...Trash,
    ...Documents,
    ...Grid,
    ...Cursor,
    ...Editor,
    ...Settings,
    ...Dialogs
});

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
