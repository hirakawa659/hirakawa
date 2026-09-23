/**
 * 原稿用紙グリッド計算・動的文字数設定・文字数カウンター
 */
import { d, f, g, s, getCurrentFileId } from '../data/storage.js';
import { cleanLegacyPastedHTML, cleanExcessiveSequentialBlankDivs, extractAndCountDialogue } from '../utils/text.js';

export function getGlobalCols() {
    try {
        const saved = localStorage.getItem('n_w');
        if (saved) {
            const n = parseInt(saved, 10);
            // ユーザーが選んだ値（22 を含む）をそのまま尊重する。以前は 22 を 20 に強制変換していた
            if (!isNaN(n) && n >= 18 && n <= 100) return n;
        }
    } catch (e) { /* localStorage 不可（プライベートモード等）はデフォルト値 */ }
    return 30;
}

export function saveGlobalCols(cols) {
    try {
        localStorage.setItem('n_w', String(cols));
    } catch (e) {}
}

export function getActiveCols(target = null) {
    let item = null;
    let targetId = null;

    if (target && typeof target === 'object') {
        item = target;
        targetId = item.id;
    } else if (typeof target === 'string') {
        targetId = target;
    } else {
        targetId = typeof getCurrentFileId === 'function' ? getCurrentFileId() : (f || (typeof window !== 'undefined' ? window.f : null));
        if (!targetId) {
            try {
                targetId = localStorage.getItem('n_c');
            } catch (e) {}
        }
    }

    if (targetId && !item) {
        if (typeof g === 'function') item = g(targetId);
        else if (typeof window !== 'undefined' && typeof window.g === 'function') item = window.g(targetId);
    }

    let custom = item ? item.customCols : 'no_item';
    let globalW = getGlobalCols();
    let res = globalW;

    if (item && item.customCols) {
        let cc = parseInt(item.customCols, 10);
        if (!isNaN(cc) && cc >= 18 && cc <= 100) res = cc;
    }
    // console.log('[DEBUG TRACE] getActiveCols:', { targetId, custom, globalW, res });
    return res;
}

export function updateColsDisplay() {
    let targetId = typeof getCurrentFileId === 'function' ? getCurrentFileId() : (f || (typeof window !== 'undefined' ? window.f : null));
    let cols = getActiveCols(targetId);

    const colsBtn = document.getElementById('colsBtn');
    if (colsBtn) {
        colsBtn.innerHTML = `横の数<br><span style="font-size:10.5px;font-weight:bold;color:#000000">${cols}字</span><span style="font-size:8px;line-height:1;margin-left:1px">▾</span>`;
        colsBtn.style.lineHeight = '1.15';
        colsBtn.style.whiteSpace = 'normal';
    }

    let valEl = document.getElementById('tool_select_val');
    if (valEl) {
        valEl.textContent = cols + '文字 ▾';
    }

    let badge = document.getElementById('toolColsCountBadge');
    if (badge) {
        badge.textContent = `${cols}文字`;
    }

    let select = document.getElementById('colsModalSelect');
    if (select) {
        select.value = String(cols);
    }

    const l = document.getElementById('l');
    if (l && l.value !== String(cols)) {
        l.value = String(cols);
    }
}

export function z() {
    const w = document.getElementById('w');
    const e = document.getElementById('e');
    const l = document.getElementById('l');
    if (!w || !e) return;

    let targetId = typeof getCurrentFileId === 'function' ? getCurrentFileId() : (f || (typeof window !== 'undefined' ? window.f : null));
    let num = getActiveCols(targetId);
    if (l && l.value !== String(num)) {
        l.value = String(num);
    }

    const m = document.querySelector('.m');
    const mWidth = m ? m.clientWidth : (typeof window !== 'undefined' ? window.innerWidth - 200 : 800);

    let avail = mWidth;
    if (avail < 100) avail = 100;

    let cs = avail / num;
    if (cs < 12) cs = 12;
    if (cs > 64) cs = 64;

    document.documentElement.style.setProperty('--cs', cs + 'px');
    document.documentElement.style.setProperty('--cols', String(num));
    w.style.width = `calc(var(--cs) * ${num})`;
    e.style.width = `calc(var(--cs) * ${num})`;
    e.style.borderRight = 'none';

    if (typeof window !== 'undefined' && typeof window.ensureGridLines === 'function') {
        window.ensureGridLines();
    } else {
        ensureGridLines();
    }

    updateColsDisplay();
}

export function ensureGridLines() {
    const e = document.getElementById('e');
    if (!e) return;
    let childNodes = Array.from(e.childNodes);
    if (childNodes.length === 0) {
        e.innerHTML = '<div><br></div>';
        return;
    }

    let needsNormalization = false;
    for (let node of childNodes) {
        if (node.nodeType === 3 && node.textContent.trim().length > 0) {
            needsNormalization = true;
            break;
        }
        if (node.nodeType === 1 && node.nodeName !== 'DIV') {
            needsNormalization = true;
            break;
        }
    }

    if (needsNormalization) {
        let rawHtml = e.innerHTML;
        let clean = cleanLegacyPastedHTML(rawHtml);
        let lines = clean.split(/<div>|<br\s*\/?>/i).filter(s => s.length > 0);
        if (lines.length === 0) {
            e.innerHTML = '<div><br></div>';
        } else {
            e.innerHTML = lines.map(line => `<div>${line.replace(/<\/div>/gi, '') || '<br>'}</div>`).join('');
        }
    }
}

export function v() {
    const e = document.getElementById('e');
    const cEl = document.getElementById('c');
    if (!e) return;

    let text = e.innerText || '';
    let cleanText = text.replace(/[\r\n]/g, '');
    let pureCount = cleanText.replace(/[\s\u3000]/g, '').length;
    let totalCount = cleanText.length;
    let pages = (pureCount / 400).toFixed(1);

    let dialogueData = extractAndCountDialogue(text);
    let dCount = dialogueData.dialoguePureCount || 0;

    if (cEl) {
        cEl.textContent = `${pureCount.toLocaleString()}字 / 400字詰 ${pages}枚（全${totalCount.toLocaleString()}文字 | 会話${dCount.toLocaleString()}字）`;
    }

    if (typeof window.sc === 'function') window.sc();
}

export function sc() {
    // ステータスカウンター同期
    let badge = document.getElementById('editorStatusPureCount');
    if (badge) {
        const e = document.getElementById('e');
        if (e) {
            let pure = (e.innerText || '').replace(/[\r\n\s\u3000]/g, '').length;
            badge.textContent = `${pure.toLocaleString()}字`;
        }
    }
}
