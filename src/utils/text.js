/**
 * テキスト処理・文字列変換・正規化ユーティリティ
 */

export function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function sanitizeHexColor(val, fallback = '#000000') {
    if (!val || typeof val !== 'string') return fallback;
    let s = val.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
        return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
    }
    if (/^[0-9a-fA-F]{6}$/.test(s)) return ('#' + s).toLowerCase();
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
        return ('#' + s[0] + s[0] + s[1] + s[1] + s[2] + s[2]).toLowerCase();
    }
    return s.startsWith('#') ? s : fallback;
}

export function cleanExcessiveSequentialBlankDivs(html) {
    if (!html || typeof html !== 'string') return html;
    const blankPattern = /<div>(?:<br\s*\/?>|\s*|\u3000*)<\/div>/gi;
    return html.replace(/(?:<div>(?:<br\s*\/?>|\s*|\u3000*)<\/div>\s*){4,}/gi, '<div><br></div><div><br></div><div><br></div>');
}

export function cleanLegacyPastedHTML(html) {
    if (!html || typeof html !== 'string') return html;
    let s = html
        .replace(/<span\s+class=["']sp-hl["'][^>]*>(.*?)<\/span>/gi, '$1')
        .replace(/<span\s+class=["']char-count-hl["'][^>]*>(.*?)<\/span>/gi, '$1')
        .replace(/<span\s+class=["']search-match-hl["'][^>]*>(.*?)<\/span>/gi, '$1')
        .replace(/<span\s+class=["']search-target-line["'][^>]*>(.*?)<\/span>/gi, '$1')
        .replace(/<span\s+class=["']ruby-annotation["'][^>]*>(.*?)<\/span>/gi, '$1')
        .replace(/<span\s+style=["'][^"']*["'][^>]*>(.*?)<\/span>/gi, '$1');
    return cleanExcessiveSequentialBlankDivs(s);
}

export function getStoryPlainText(html) {
    if (!html) return '';
    let div = document.createElement('div');
    div.innerHTML = cleanLegacyPastedHTML(html);
    return div.innerText || div.textContent || '';
}

export function countStoryCharactersPure(html) {
    let plain = getStoryPlainText(html);
    return plain.replace(/[\r\n\s\u3000]/g, '').length;
}

export function extractAndCountDialogue(text) {
    if (!text) return { dialoguePureCount: 0, dialogueTexts: [] };
    let clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let dialogues = [];
    let count = 0;
    
    // かぎ括弧「」および二重かぎ括弧『』の抽出
    let regex = /[「『]([\s\S]*?)[」』]/g;
    let match;
    while ((match = regex.exec(clean)) !== null) {
        let full = match[0];
        let inner = match[1];
        let innerPure = inner.replace(/[\s\u3000\r\n]/g, '');
        // 括弧2文字 + 中身文字数（空白除外）
        let charLen = 2 + innerPure.length;
        count += charLen;
        dialogues.push({
            full: full,
            inner: inner,
            innerPureLength: innerPure.length,
            totalLength: charLen
        });
    }
    return { dialoguePureCount: count, dialogueTexts: dialogues };
}
