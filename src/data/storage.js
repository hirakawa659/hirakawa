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

export let d = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    r: [],
    trash: []
};
export let f = null; // 現在開いているファイルID
export let pId = 'root'; // 現在開いているフォルダID

export function setGlobalData(newData) {
    if (!newData) return;
    d = newData;
    if (!d.trash) d.trash = [];
    if (!d.schemaVersion) d.schemaVersion = SCHEMA_VERSION;
    if (!d.updatedAt) d.updatedAt = new Date().toISOString();
    if (!d.deviceId) d.deviceId = getDeviceId();
}

export function setCurrentFileId(id) {
    f = id;
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
export function g(id, list = (d ? d.r : [])) {
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
export function walkAllItems(fn, list = (d ? d.r : [])) {
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
        if (f) localStorage.setItem('n_c', f);
        const l = document.getElementById('l');
        if (l && l.value) localStorage.setItem('n_w', l.value);
    } catch (err) {
        console.error('Storage save error:', err);
    }
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
