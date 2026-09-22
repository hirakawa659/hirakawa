/**
 * 原稿ドキュメント・フォルダ階層・サイドバーツリー・本棚ビュー管理
 */
import { escapeHtml, getStoryPlainText } from '../utils/text.js';
import { d, f, g, s, setCurrentFileId, setCurrentFolderId, walkAllItems, flushPendingHeavyTask } from '../data/storage.js';
import { findItemContext, findParentNode } from '../data/migration.js';
import { updateTrashCount } from './trash.js';

export let currentViewMode = 'editor';
export let currentShelfFolderId = 'root';
export let currentShelfSearchQuery = '';
export let currentModalItemId = null;

export function openFile(id) {
    if (typeof flushPendingHeavyTask === 'function') flushPendingHeavyTask();
    s();
    setCurrentFileId(id);
    const item = g(id);
    const e = document.getElementById('e');
    if (item && e) {
        e.innerHTML = item.content || '<div><br></div>';
        if (typeof window.ensureGridLines === 'function') window.ensureGridLines();
        if (typeof window.z === 'function') window.z();
        if (typeof window.v === 'function') window.v();
        s();
    }
    if (typeof window.r === 'function') window.r();
    if (typeof window.updateCurrentStoryDisplay === 'function') window.updateCurrentStoryDisplay();
}

export function createItem(type, parentFolderId = 'root', customName = null) {
    let newItem = {
        id: (type === 'folder' ? 'f_' : 'd_') + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: type,
        name: customName || (type === 'folder' ? '新規フォルダ' : '新規原稿')
    };

    if (type === 'file') {
        newItem.content = '<div><br></div>';
    } else {
        newItem.children = [];
    }

    if (!parentFolderId || parentFolderId === 'root') {
        d.r.push(newItem);
    } else {
        let parent = g(parentFolderId);
        if (parent && parent.type === 'folder') {
            if (!parent.children) parent.children = [];
            parent.children.push(newItem);
        } else {
            d.r.push(newItem);
        }
    }

    s();
    if (type === 'file') {
        openFile(newItem.id);
    } else {
        if (typeof window.r === 'function') window.r();
    }
    return newItem;
}

export function deleteItem(id, skipConfirm = false) {
    let ctx = findItemContext(id);
    if (!ctx) return false;
    let item = ctx.item;

    if (!skipConfirm) {
        let msg = `「${item.name || '無題'}」をゴミ箱に移動しますか？`;
        if (!confirm(msg)) return false;
    }

    // ゴミ箱に保管（削除日時を記録）
    item.deletedAt = new Date().toISOString();
    if (!d.trash) d.trash = [];
    d.trash.unshift(item);

    ctx.siblings.splice(ctx.index, 1);
    s();
    updateTrashCount();

    if (f === id) {
        let nextFile = null;
        walkAllItems(it => {
            if (!nextFile && it.type === 'file') nextFile = it.id;
        });
        if (nextFile) {
            openFile(nextFile);
        } else {
            createItem('file', 'root', '無題の原稿');
        }
    } else {
        if (typeof window.r === 'function') window.r();
    }

    return true;
}

export function duplicateItem(id) {
    let item = g(id);
    if (!item) return null;

    let ctx = findItemContext(id);
    if (!ctx) return null;

    function cloneWithNewIds(it) {
        let copy = {
            id: (it.type === 'folder' ? 'f_' : 'd_') + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            type: it.type,
            name: (it.name || '無題') + '（コピー）'
        };
        if (it.type === 'file') {
            copy.content = it.content || '<div><br></div>';
            if (it.customCols) copy.customCols = it.customCols;
        } else {
            copy.children = (it.children || []).map(cloneWithNewIds);
        }
        return copy;
    }

    let cloned = cloneWithNewIds(item);
    ctx.siblings.splice(ctx.index + 1, 0, cloned);
    s();
    if (typeof window.r === 'function') window.r();
    return cloned;
}
