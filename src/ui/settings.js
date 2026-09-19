/**
 * 設定・ツールバー並び替え・カスタムボタン名・配色テーマ管理
 */
import { sanitizeHexColor } from '../utils/text.js';

export const TOOLBAR_STORAGE_KEY = 'n_to_v9';
export const LINENUM_TOOLBAR_STORAGE_KEY = 'n_lto_v9';
export const CUSTOM_LABELS_STORAGE_KEY = 'n_cl_v9';

export const DEFAULT_PAPER_THEME = {
    paperBg: '#ffffff',
    gridLine: '#ececec',
    paperText: '#000000',
    lineNumText: '#aaaaaa'
};

export const DEFAULT_FOLDER_THEME = {
    folderPaperBg: '#ffffff',
    folderGridLine: '#ececec',
    folderPaperText: '#000000',
    folderLineNumText: '#aaaaaa'
};

export const DEFAULT_SIDEBAR_THEME = {
    sidebarBg: '#1e293b',
    sidebarText: '#f8fafc',
    sidebarSelectBg: '#3b82f6',
    sidebarSelectText: '#ffffff'
};

export const DEFAULT_TOOLBAR_THEME = {
    toolbarBg: '#ffffff',
    toolbarText: '#1e293b',
    toolbarBorder: '#cbd5e1'
};

export function getCustomToolLabels() {
    try {
        let val = localStorage.getItem(CUSTOM_LABELS_STORAGE_KEY);
        return val ? JSON.parse(val) : {};
    } catch (e) {
        return {};
    }
}

export function saveCustomToolLabels(labels) {
    try {
        localStorage.setItem(CUSTOM_LABELS_STORAGE_KEY, JSON.stringify(labels || {}));
    } catch (e) {
        console.error('Error saving custom tool labels:', e);
    }
}

export function applyCurrentTheme() {
    let paperSettings = null;
    try {
        let pSaved = localStorage.getItem('n_paper_theme');
        if (pSaved) paperSettings = JSON.parse(pSaved);
    } catch (e) { }

    let theme = Object.assign({}, DEFAULT_PAPER_THEME, paperSettings);
    let root = document.documentElement;

    root.style.setProperty('--paper-bg', theme.paperBg || '#ffffff');
    root.style.setProperty('--grid-line', theme.gridLine || '#ececec');
    root.style.setProperty('--paper-text', theme.paperText || '#000000');
    root.style.setProperty('--line-num-text', theme.lineNumText || '#aaaaaa');
}
