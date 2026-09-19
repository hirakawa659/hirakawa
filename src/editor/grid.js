/**
 * 原稿用紙グリッド計算・動的文字数設定・行番号描画・文字数カウンター
 */
import { d, f, g, s } from '../data/storage.js';
import { cleanLegacyPastedHTML, cleanExcessiveSequentialBlankDivs, extractAndCountDialogue } from '../utils/text.js';

export function getActiveCols(item = null) {
    if (!item && f) item = g(f);
    if (item && item.customCols) {
        let cc = parseInt(item.customCols);
        if (!isNaN(cc) && cc >= 10 && cc <= 100) return cc;
    }
    const l = document.getElementById('l');
    let globalVal = l ? parseInt(l.value) : 30;
    if (isNaN(globalVal) || globalVal < 10) globalVal = 30;
    return globalVal;
}

export function updateColsDisplay() {
    let active = getActiveCols();
    let badge = document.getElementById('toolColsCountBadge');
    if (badge) badge.textContent = `${active}文字`;
    let select = document.getElementById('colsModalSelect');
    if (select) select.value = String(active);
}

export function z() {
    const w = document.getElementById('w');
    const e = document.getElementById('e');
    const l = document.getElementById('l');
    if (!w || !e || !l) return;

    let cols = getActiveCols();
    if (l.value !== String(cols)) {
        l.value = String(cols);
    }

    // エディタ領域の幅とパディングから1マスサイズ（--cs）を動的に計算
    let containerWidth = w.clientWidth || 800;
    let availableWidth = Math.max(300, containerWidth - 60);
    let calculatedCs = Math.max(22, Math.min(42, Math.floor(availableWidth / cols)));

    document.documentElement.style.setProperty('--cs', `${calculatedCs}px`);
    document.documentElement.style.setProperty('--cols', `${cols}`);
    e.style.width = `${calculatedCs * cols}px`;

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
    const nEl = document.getElementById('n');
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

    // 行番号の更新
    if (nEl) {
        let divs = e.querySelectorAll('#e>div');
        let totalRows = Math.max(1, divs.length);
        let numsHtml = '';
        for (let i = 1; i <= totalRows; i++) {
            numsHtml += `<div class="ln">${i}</div>`;
        }
        nEl.innerHTML = numsHtml;
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
