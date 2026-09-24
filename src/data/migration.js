/**
 * データマイグレーション・ツリー階層修復・並び替えコンテキスト
 */
import { d, s, walkAllItems } from './storage.js';

export function findItemContext(itemId, list = (d ? d.r : []), parent = null) {
    if (!list || !Array.isArray(list)) return null;
    for (let i = 0; i < list.length; i++) {
        let it = list[i];
        if (it.id === itemId) {
            return { item: it, parent: parent, index: i, siblings: list };
        }
        if (it.children && Array.isArray(it.children)) {
            let res = findItemContext(itemId, it.children, it);
            if (res) return res;
        }
    }
    return null;
}

export function findParentNode(childId, list = (d ? d.r : []), parent = null) {
    if (!list || !Array.isArray(list)) return null;
    for (let it of list) {
        if (it.id === childId) return parent;
        if (it.children && Array.isArray(it.children)) {
            let found = findParentNode(childId, it.children, it);
            if (found !== null) return found;
        }
    }
    return null;
}

export function reorderTreeItem(sourceId, targetId, position) {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    let sCtx = findItemContext(sourceId);
    let tCtx = findItemContext(targetId);
    if (!sCtx || !tCtx) return false;

    // 自分自身の子孫への移動を防止
    let isDescendant = false;
    let checkDescendant = (node) => {
        if (!node || !node.children) return;
        for (let c of node.children) {
            if (c.id === targetId) { isDescendant = true; return; }
            checkDescendant(c);
        }
    };
    checkDescendant(sCtx.item);
    if (isDescendant) return false;

    // 元の位置から削除
    sCtx.siblings.splice(sCtx.index, 1);

    if (position === 'inside') {
        if (tCtx.item.type === 'folder') {
            if (!tCtx.item.children) tCtx.item.children = [];
            tCtx.item.children.push(sCtx.item);
        } else {
            // ファイルの中には入れられないので親フォルダの末尾へ
            tCtx.siblings.push(sCtx.item);
        }
    } else {
        // 同じ階層（siblings）内の前後
        let newTargetIndex = tCtx.siblings.findIndex(it => it.id === targetId);
        if (newTargetIndex === -1) {
            tCtx.siblings.push(sCtx.item);
        } else {
            let insertIdx = (position === 'before') ? newTargetIndex : newTargetIndex + 1;
            tCtx.siblings.splice(insertIdx, 0, sCtx.item);
        }
    }

    s();
    return true;
}

export function reorderRootItem(sourceId, position) {
    if (!sourceId || !d || !d.r) return false;
    let sCtx = findItemContext(sourceId);
    if (!sCtx) return false;

    sCtx.siblings.splice(sCtx.index, 1);
    if (position === 'start') {
        d.r.unshift(sCtx.item);
    } else {
        d.r.push(sCtx.item);
    }
    s();
    return true;
}

export function repairAndMigrateData() {
    if (!d || !Array.isArray(d.r)) {
        d = { r: [], trash: [] };
    }
    if (!d.trash || !Array.isArray(d.trash)) {
        d.trash = [];
    }

    // 各ノードの健全性確認（ID欠落の補完、破損修復）
    walkAllItems(it => {
        if (!it.id) {
            it.id = (it.type === 'folder' ? 'f_' : 'd_') + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        }
        if (it.type === 'folder' && !Array.isArray(it.children)) {
            it.children = [];
        }
        if (it.type === 'file' && typeof it.content !== 'string') {
            it.content = '<div><br></div>';
        }
    });
}
