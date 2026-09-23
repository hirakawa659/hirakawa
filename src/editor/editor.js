/**
 * エディタ本文入力・ペースト処理・空白置換・文字検出・ワープ検索
 */
import { d, f, g, s, pushHistoryState, scheduleHeavyTask } from '../data/storage.js';
import { ensureGridLines, v } from './grid.js';
import { cleanLegacyPastedHTML, cleanExcessiveSequentialBlankDivs } from '../utils/text.js';

export let currentSearchIndex = 0;
export let currentSearchResults = [];

export function warpNext() {
    let input = document.getElementById('localWarpInput');
    let kw = input ? input.value.trim() : '';
    if (!kw) {
        let gInput = document.getElementById('globalWarpInput');
        kw = gInput ? gInput.value.trim() : '';
    }
    if (!kw) {
        if (typeof window.openWarpModal === 'function') window.openWarpModal();
        return;
    }
    executeWarpKeyword(kw, 1);
}

export function warpPrev() {
    let input = document.getElementById('localWarpInput');
    let kw = input ? input.value.trim() : '';
    if (!kw) {
        let gInput = document.getElementById('globalWarpInput');
        kw = gInput ? gInput.value.trim() : '';
    }
    if (!kw) {
        if (typeof window.openWarpModal === 'function') window.openWarpModal();
        return;
    }
    executeWarpKeyword(kw, -1);
}

export function executeWarpKeyword(keyword, direction = 1) {
    if (!keyword) return;
    const e = document.getElementById('e');
    if (!e) return;
    let divs = Array.from(e.querySelectorAll('#e>div'));
    if (divs.length === 0) return;

    let matches = [];
    divs.forEach((div, rIdx) => {
        let txt = div.textContent;
        let pos = 0;
        while ((pos = txt.indexOf(keyword, pos)) !== -1) {
            matches.push({ row: rIdx, col: pos, div: div });
            pos += keyword.length;
        }
    });

    if (matches.length === 0) {
        alert(`「${keyword}」は見つかりませんでした。`);
        return;
    }

    if (direction > 0) {
        currentSearchIndex = (currentSearchIndex + 1) % matches.length;
    } else {
        currentSearchIndex = (currentSearchIndex - 1 + matches.length) % matches.length;
    }

    let target = matches[currentSearchIndex];
    if (target && target.div) {
        target.div.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof window.applyCaretToDiv === 'function') {
            window.applyCaretToDiv(target.div, target.col, 100);
        }
    }
}

export function execDetectHiddenChars() {
    const e = document.getElementById('e');
    if (!e) return;
    const hiddenCharRegex = /[\u200B-\u200D\uFEFF\u00A0\u2028\u2029\u200E\u200F\u0000-\u001F\u007F-\u009F]/g;
    let text = e.innerText || '';
    let matches = text.match(hiddenCharRegex);
    if (!matches || matches.length === 0) {
        alert('隠し文字（ゼロ幅スペース・特殊制御コード等）は見つかりませんでした。');
    } else {
        alert(`隠し文字が ${matches.length} 箇所見つかりました。\n「隠し文字 一括削除」で消去できます。`);
    }
}

export function execDeleteAllHiddenChars() {
    const e = document.getElementById('e');
    if (!e) return;
    let html = e.innerHTML;
    let clean = html.replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029\u200E\u200F\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    if (html !== clean) {
        e.innerHTML = clean;
        ensureGridLines();
        v();
        s();
        alert('隠し文字を一括削除しました。');
    } else {
        alert('削除対象の隠し文字はありませんでした。');
    }
}

export function execDetectHomoglyphs() {
    const e = document.getElementById('e');
    if (!e) return;
    const homoRegex = /[\u0430-\u044F\u0370-\u03FF]/g; // キリル・ギリシャ等の類似文字
    let text = e.innerText || '';
    let matches = text.match(homoRegex);
    if (!matches || matches.length === 0) {
        alert('紛らわしい類似文字（ホモグラフ）は見つかりませんでした。');
    } else {
        alert(`類似文字（ホモグラフ）が ${matches.length} 箇所見つかりました。`);
    }
}

export function execDetectNumericDigits() {
    const e = document.getElementById('e');
    if (!e) return;
    let text = e.innerText || '';
    let matches = text.match(/[0-9０-９]/g);
    let count = matches ? matches.length : 0;
    alert(`算用数字が合計 ${count} 文字含まれています。`);
}

export function execDetectHalfWidth() {
    const e = document.getElementById('e');
    if (!e) return;
    let text = e.innerText || '';
    let matches = text.match(/[\u0020-\u007E]/g);
    let count = matches ? matches.length : 0;
    alert(`半角文字（英数字記号空白）が合計 ${count} 文字含まれています。`);
}

export function execConvertAllHalfToZen() {
    const e = document.getElementById('e');
    if (!e) return;
    let divs = e.querySelectorAll('#e>div');
    divs.forEach(div => {
        let txt = div.innerHTML;
        // 半角英数字・記号・空白の全角変換
        let converted = txt.replace(/[\u0020-\u007E]/g, ch => {
            if (ch === ' ') return '　';
            let code = ch.charCodeAt(0);
            return String.fromCharCode(code + 0xFEE0);
        });
        div.innerHTML = converted;
    });
    ensureGridLines();
    v();
    s();
    alert('すべての半角文字を全角に変換しました。');
}

export function execConvertSpecifiedHalfToZen() {
    const slots = document.querySelectorAll('.half-zen-slot');
    let targetChars = [];
    slots.forEach(s => {
        let val = s.value ? s.value.trim() : '';
        if (val) targetChars.push(val);
    });

    if (targetChars.length === 0) {
        alert('変換対象の文字をマス目に1文字以上入力してください。');
        return;
    }

    const e = document.getElementById('e');
    if (!e) return;
    let divs = e.querySelectorAll('#e>div');
    divs.forEach(div => {
        let txt = div.innerHTML;
        targetChars.forEach(ch => {
            let zenCh = (ch === ' ') ? '　' : String.fromCharCode(ch.charCodeAt(0) + 0xFEE0);
            let reg = new RegExp(ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            txt = txt.replace(reg, zenCh);
        });
        div.innerHTML = txt;
    });
    ensureGridLines();
    v();
    s();
    alert(`指定した文字（${targetChars.join(' ')}）を全角に変換しました。`);
}
