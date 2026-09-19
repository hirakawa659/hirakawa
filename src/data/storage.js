/**
 * データ管理・ローカルストレージ・履歴（アンドゥ/リドゥ）・タスクスケジュール
 */
import { cleanLegacyPastedHTML, cleanExcessiveSequentialBlankDivs } from '../utils/text.js';

// グローバルデータ参照
export let d = { r: [], trash: [] };
export let f = null; // 現在開いているファイルID
export let pId = 'root'; // 現在開いているフォルダID

export function setGlobalData(newData) {
    d = newData;
    if (!d.trash) d.trash = [];
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
        localStorage.setItem('n_d', JSON.stringify(d));
        if (f) localStorage.setItem('n_c', f);
        const l = document.getElementById('l');
        if (l && l.value) localStorage.setItem('n_w', l.value);
    } catch (err) {
        console.error('Storage save error:', err);
    }
}

// データ初期読み込み
export function loadInitialData() {
    let saved = localStorage.getItem('n_d');
    if (saved) {
        try {
            d = JSON.parse(saved);
            if (!d.trash) d.trash = [];
        } catch (e) {
            console.error('Failed to parse n_d from localStorage:', e);
            d = { r: [], trash: [] };
        }
    } else {
        // 初期サンプルデータ
        d = {
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
