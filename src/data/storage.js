/**
 * データ管理・ローカルストレージ・履歴（アンドゥ/リドゥ）・タスクスケジュール
 */
import { cleanLegacyPastedHTML, cleanExcessiveSequentialBlankDivs } from '../utils/text.js';

// グローバルデータ参照
export const SCHEMA_VERSION = 1;

export function getDeviceId() {
    let id = localStorage.getItem('n_device_id');
    if (!id) {
        id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
        localStorage.setItem('n_device_id', id);
    }
    return id;
}

export let d = (function() {
    try {
        let saved = typeof localStorage !== 'undefined' ? localStorage.getItem('n_d') : null;
        if (saved) {
            let parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.r)) return parsed;
        }
    } catch(e) {}
    return {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        r: [],
        trash: []
    };
})();
export let f = (function() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem('n_c') : null;
    } catch(e) {}
    return null;
})();
export let pId = 'root'; // 現在開いているフォルダID

// ※以前は customCols === 22 を 20 に強制変換していたため、ユーザーが選んだ「22文字」が
//   データ読み込み・同期のたびに 20 に書き戻されていた。ユーザー設定は一切書き換えない。
function cleanupCols(targetData) {
    if (!targetData) return;
    function walk(list) {
        if (!Array.isArray(list)) return;
        for (let it of list) {
            if (!it || typeof it !== 'object') continue;
            if (it.customCols !== undefined && it.customCols !== null) {
                const n = parseInt(it.customCols, 10);
                // 範囲外・不正値のみ除去（正しい値は触らない）
                if (isNaN(n) || n < 18 || n > 100) delete it.customCols;
                else if (it.customCols !== n) it.customCols = n;
            }
            if (Array.isArray(it.children)) walk(it.children);
        }
    }
    if (targetData.r) walk(targetData.r);
    if (targetData.trash) walk(targetData.trash);
}

export function setGlobalData(newData) {
    if (!newData) return;
    cleanupCols(newData);
    d = newData;
    if (typeof window !== 'undefined') {
        window.d = newData;
        // index.html 本体側の d（let d）と同じオブジェクトを共有させる
        // （クラウド復元などモジュール側でデータが差し替わっても本体が古いデータのまま残らないようにする）
        if (typeof window.__novelBridge === 'object' && window.__novelBridge && typeof window.__novelBridge.setData === 'function') {
            try { window.__novelBridge.setData(newData); } catch (err) { console.error('bridge.setData error:', err); }
        }
    }
    if (!d.trash) d.trash = [];
    if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
    if (!d.updatedAt) d.updatedAt = new Date().toISOString();
    if (!d.deviceId) d.deviceId = getDeviceId();
}

export function getGlobalData() {
    let res = null;
    if (typeof window !== 'undefined' && window.d && Array.isArray(window.d.r) && window.d.r.length > 0) {
        res = window.d;
    } else if (d && Array.isArray(d.r) && d.r.length > 0) {
        res = d;
    } else {
        try {
            let saved = typeof localStorage !== 'undefined' ? localStorage.getItem('n_d') : null;
            if (saved) {
                let parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.r)) {
                    d = parsed;
                    res = d;
                }
            }
        } catch(e) {}
        res = d;
    }
    cleanupCols(res);
    return res;
}

export function setCurrentFileId(id) {
    f = id;
    if (typeof window !== 'undefined') {
        window.f = id;
        if (typeof window.__novelBridge === 'object' && window.__novelBridge && typeof window.__novelBridge.setFileId === 'function') {
            try { window.__novelBridge.setFileId(id); } catch (err) { console.error('bridge.setFileId error:', err); }
        }
    }
}

export function getCurrentFileId() {
    if (f) return f;
    if (typeof window !== 'undefined' && window.f) return window.f;
    try {
        let sc = localStorage.getItem('n_c');
        if (sc) return sc;
    } catch (e) {}
    return null;
}

export function setCurrentFolderId(id) {
    pId = id;
}

// 履歴スタック
export let historyStack = [];
export let historyIndex = -1;
const MAX_HISTORY = 40;

export function pushHistoryState(fileId, content) {
    if (!fileId) return;
    // 現在のインデックスより後の履歴を削除して新しい状態を追加
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push({ fileId, content });
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyIndex++;
    }
}

export function undoHistory() {
    if (historyIndex > 0) {
        historyIndex--;
        const state = historyStack[historyIndex];
        return state;
    }
    return null;
}

export function redoHistory() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        const state = historyStack[historyIndex];
        return state;
    }
    return null;
}

// IDによるアイテム検索
export function g(id, list = null) {
    if (!id) return null;
    if (!list || !Array.isArray(list) || list.length === 0) {
        let globalData = getGlobalData();
        if (globalData && Array.isArray(globalData.r)) list = globalData.r;
    }
    if (!list || !Array.isArray(list)) return null;
    for (let it of list) {
        if (it.id === id) return it;
        if (it.children) {
            let res = g(id, it.children);
            if (res) return res;
        }
    }
    return null;
}

// 全アイテム走査
export function walkAllItems(fn, list = null) {
    if (!list || !Array.isArray(list) || list.length === 0) {
        let globalData = getGlobalData();
        if (globalData && Array.isArray(globalData.r)) list = globalData.r;
    }
    if (!list || !Array.isArray(list)) return;
    for (let item of list) {
        fn(item);
        if (item.children && Array.isArray(item.children)) {
            walkAllItems(fn, item.children);
        }
    }
}

// 保存処理
export function s() {
    if (!d) return;
    try {
        if (!d.trash) d.trash = [];
        d.schemaVersion = SCHEMA_VERSION;
        d.updatedAt = new Date().toISOString();
        if (!d.deviceId) d.deviceId = getDeviceId();

        localStorage.setItem('n_d', JSON.stringify(d));
        localStorage.setItem('n_last_saved_time', String(Date.now()));
        let activeId = getCurrentFileId();
        if (activeId) localStorage.setItem('n_c', activeId);
    } catch (err) {
        console.error('Storage save error:', err);
    }
}

// 共通の保存・状態保持処理（本文、スクロール位置、カーソル位置、アクティブファイルID）
let autoSaveTimer = null;

export function saveCurrentEditorState() {
    try {
        const e = document.getElementById('e');
        const m = document.querySelector('.m');

        // 本文の保存は index.html 本体の s() に一本化する（モジュール側の d は古い可能性があり、
        // ここで直接 localStorage に書くと新しい本文を古いデータで上書きするおそれがあるため）
        if (typeof window.flushPendingHeavyTask === 'function') window.flushPendingHeavyTask();
        if (typeof window.s === 'function' && window.s !== s) window.s();
        else s();

        // スクロール位置の保存
        if (m) {
            localStorage.setItem('n_scroll_top', String(m.scrollTop));
        }
        // カーソル位置の保存（caret offset）
        const sel = window.getSelection ? window.getSelection() : null;
        if (sel && sel.rangeCount > 0 && e && e.contains(sel.anchorNode)) {
            try {
                const range = sel.getRangeAt(0);
                const preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(e);
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                localStorage.setItem('n_caret_offset', String(preCaretRange.toString().length));
            } catch (err) { /* 選択範囲が不正でも保存処理全体は止めない */ }
        }
        const activeId = getCurrentFileId();
        if (activeId) {
            localStorage.setItem('n_c', activeId);
        }
    } catch (err) {
        console.error('saveCurrentEditorState error:', err);
    }
}

export function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        saveCurrentEditorState();
    }, 1500); // 1.5秒のデバウンス
}

// 原稿文字数の高速計算（純粋データ用）
export function getManuscriptStats(targetData = d) {
    let totalChars = 0;
    let fileCount = 0;
    let folderCount = 0;
    let sampleTitle = '';

    function walk(items) {
        if (!items || !Array.isArray(items)) return;
        for (let it of items) {
            if (it.type === 'file') {
                fileCount++;
                if (!sampleTitle && it.name) sampleTitle = it.name;
                if (it.content) {
                    let plain = it.content
                        .replace(/<[^>]*>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/[\r\n\s\u3000]/g, '');
                    totalChars += plain.length;
                }
            } else if (it.type === 'folder') {
                folderCount++;
                if (it.children) walk(it.children);
            }
        }
    }
    walk(targetData ? targetData.r : []);
    return { totalChars, fileCount, folderCount, sampleTitle };
}

// 安全バックアップ（上書き直前・競合時の復元用スナップショット）
const MAX_SAFETY_SNAPSHOTS = 12;

export function saveSafetySnapshot(reason = 'auto_backup', customData = null) {
    try {
        let target = customData || d;
        if (!target || !target.r) return null;

        let stats = getManuscriptStats(target);
        let snapshot = {
            id: 'snap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp: Date.now(),
            isoDate: new Date().toISOString(),
            reason: reason,
            fileCount: stats.fileCount,
            totalChars: stats.totalChars,
            sampleTitle: stats.sampleTitle || '無題の原稿',
            data: JSON.parse(JSON.stringify(target))
        };

        let saved = localStorage.getItem('n_safety_snapshots');
        let list = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(list)) list = [];

        list.unshift(snapshot);
        if (list.length > MAX_SAFETY_SNAPSHOTS) {
            list = list.slice(0, MAX_SAFETY_SNAPSHOTS);
        }

        localStorage.setItem('n_safety_snapshots', JSON.stringify(list));
        return snapshot;
    } catch (e) {
        console.warn('Failed to save safety snapshot:', e);
        return null;
    }
}

export function getSafetySnapshots() {
    try {
        let saved = localStorage.getItem('n_safety_snapshots');
        let list = saved ? JSON.parse(saved) : [];
        return Array.isArray(list) ? list : [];
    } catch (e) {
        return [];
    }
}

export function restoreSafetySnapshot(snapshotId) {
    let snapshots = getSafetySnapshots();
    let target = snapshots.find(s => s.id === snapshotId);
    if (!target || !target.data) return false;

    // 現在の状態も直前バックアップ
    saveSafetySnapshot('before_snapshot_restore');
    setGlobalData(target.data);
    s();
    if (typeof window.r === 'function') window.r();
    if (typeof window.o === 'function' && f) window.o(f);
    if (typeof window.updateCurrentStoryDisplay === 'function') window.updateCurrentStoryDisplay();
    return true;
}

// データ初期読み込み
export function loadInitialData() {
    let saved = localStorage.getItem('n_d');
    if (saved) {
        try {
            d = JSON.parse(saved);
            if (!d.trash) d.trash = [];
            if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
            if (!d.updatedAt) d.updatedAt = new Date().toISOString();
            if (!d.deviceId) d.deviceId = getDeviceId();
        } catch (e) {
            console.error('Failed to parse n_d from localStorage:', e);
            d = {
                schemaVersion: SCHEMA_VERSION,
                updatedAt: new Date().toISOString(),
                deviceId: getDeviceId(),
                r: [],
                trash: []
            };
        }
    } else {
        // 初期サンプルデータ
        d = {
            schemaVersion: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
            deviceId: getDeviceId(),
            r: [
                {
                    id: 'f_default_sample',
                    type: 'folder',
                    name: 'サンプル小説',
                    children: [
                        {
                            id: 'd_default_1',
                            type: 'file',
                            name: '第一話　はじまりの朝',
                            content: '<div>　小鳥のさえずりで目が覚めた。カーテンを開けると、柔らかな陽光が部屋いっぱいに広がる。</div><div><br></div><div>「おはよう、今日もいい天気だね」</div><div><br></div><div>　机に向かい、いつものように原稿用紙を広げた。</div>'
                        }
                    ]
                },
                {
                    id: 'd_default_root',
                    type: 'file',
                    name: '無題の原稿',
                    content: '<div>　</div>'
                }
            ],
            trash: []
        };
        s();
    }

    let savedFile = localStorage.getItem('n_c');
    if (savedFile && g(savedFile)) {
        f = savedFile;
    } else {
        // 最初の有効なファイルを探す
        walkAllItems(it => {
            if (!f && it.type === 'file') f = it.id;
        });
    }

    return { d, f };
}

// 遅延タスクスケジューラ（タイピング時の負荷軽減と自動保存）
let heavyTaskTimer = null;
let pendingHeavyTaskCallback = null;

export function scheduleHeavyTask(delay = 300, callback = null) {
    if (heavyTaskTimer) clearTimeout(heavyTaskTimer);
    if (callback) pendingHeavyTaskCallback = callback;
    heavyTaskTimer = setTimeout(() => {
        flushPendingHeavyTask();
    }, delay);
}

export function flushPendingHeavyTask() {
    if (heavyTaskTimer) {
        clearTimeout(heavyTaskTimer);
        heavyTaskTimer = null;
    }
    if (typeof pendingHeavyTaskCallback === 'function') {
        const cb = pendingHeavyTaskCallback;
        pendingHeavyTaskCallback = null;
        try { cb(); } catch (e) { console.error('Error executing heavy task:', e); }
    }
}
