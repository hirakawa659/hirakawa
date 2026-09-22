/**
 * ダイアログ・モーダル表示制御
 */
import { g, getCurrentFileId } from '../data/storage.js';
import { getActiveCols } from '../editor/grid.js';

export function openNoticeModal(type = 'default') {
    let modal = document.getElementById('noticeModal');
    let titleEl = document.getElementById('noticeHeaderTitle');
    let bodyEl = document.getElementById('noticeBody');
    if (!modal || !bodyEl) return;

    if (type === 'paste') {
        if (titleEl) titleEl.textContent = 'ペースト時の注意事項';
        bodyEl.textContent = `【ペースト機能について】
テキストを貼り付ける際、改行は自動的に新しいマス目行として配置されます。
不要な連続空行は自動的に3行以内に正規化され、グリッドの崩れを防ぎます。`;
    } else {
        if (titleEl) titleEl.textContent = '利用規約・注意事項';
        bodyEl.textContent = `【原稿用紙エディタについて】
本エディタは、日本語小説執筆に特化した原稿用紙グリッドエディタです。
・ブラウザ内のローカルストレージへ即時自動保存されます。
・Supabaseアカウントにログインすることで、複数端末間でのクラウド同期が可能です。
・定期的に「.txt保存」または「zip一括保存」でバックアップを推奨します。`;
    }
    modal.style.display = 'flex';
}

export function closeNoticeModal() {
    let modal = document.getElementById('noticeModal');
    if (modal) modal.style.display = 'none';
}

export function openWarpModal() {
    let modal = document.getElementById('warpModal');
    if (modal) modal.style.display = 'flex';
}

export function closeWarpModal() {
    let modal = document.getElementById('warpModal');
    if (modal) modal.style.display = 'none';
}

export function openColsModal(targetId = null, ev = null) {
    if (ev) ev.stopPropagation();
    if (typeof window.flushPendingHeavyTask === 'function') window.flushPendingHeavyTask();

    let resolvedId = targetId || (typeof getCurrentFileId === 'function' ? getCurrentFileId() : null) || (typeof window !== 'undefined' ? window.f : null);
    if (typeof window !== 'undefined') window.colsModalTargetId = resolvedId;

    let item = resolvedId ? (typeof g === 'function' ? g(resolvedId) : (window.g ? window.g(resolvedId) : null)) : null;
    let name = item ? (item.name || '無題') : '現在の紙';
    let currentVal = typeof getActiveCols === 'function' ? getActiveCols(resolvedId) : (window.getActiveCols ? window.getActiveCols(resolvedId) : 20);
    let isCustom = !!(item && item.customCols);

    let modal = document.getElementById('colsModal');
    let titleEl = document.getElementById('colsModalTitle');
    let subEl = document.getElementById('colsModalSubtitle');
    let sel = document.getElementById('colsModalSelect');
    let subtextCustom = document.getElementById('colsSubtextCustom');

    if (titleEl) titleEl.textContent = '横の文字数設定';
    if (subEl) subEl.textContent = `対象: 「${name}」` + (isCustom ? ' (個別設定中)' : ' (全体デフォルト)');
    if (subtextCustom) subtextCustom.textContent = `この紙（「${name}」）のみに文字数を保存`;

    if (sel) {
        if (sel.options.length === 0) {
            if (typeof window.initColsSelectOptions === 'function') {
                window.initColsSelectOptions(sel);
            } else {
                let html = '';
                for (let i = 18; i <= 40; i++) {
                    html += `<option value="${i}">${i}文字</option>`;
                }
                sel.innerHTML = html;
            }
        }
        sel.value = String(currentVal);
    }

    if (modal) modal.style.display = 'flex';
}

export function closeColsModal() {
    let modal = document.getElementById('colsModal');
    if (modal) modal.style.display = 'none';
    if (typeof window !== 'undefined') window.colsModalTargetId = null;
    if (typeof window.z === 'function') window.z();
}
