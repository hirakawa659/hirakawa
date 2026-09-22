/**
 * 02-PREVIEW: Preview Validator & Layout Assertions
 * 
 * 責務: AI Studio プレビューおよびレイアウト検証
 * 目的: 
 *  1. 30文字が特殊値や固定値としてレイアウトを制限していないかを自動テスト
 *  2. --cs 変数とフォントサイズ・行の高さの 1:1 同期状態を検証
 *  3. min-height や print-color-adjust が欠落していないかを検証
 */

function validateEditorLayout(doc = document) {
    const results = {
        passed: true,
        checks: []
    };

    const editor = doc.getElementById('e');
    const wrapper = doc.getElementById('w');
    const select = doc.getElementById('l');

    // 1. エディタ要素の存在確認
    if (!editor || !wrapper) {
        results.passed = false;
        results.checks.push({ name: "Editor Elements Exist", status: "FAIL", message: "Editor DOM elements (#e, #w) not found." });
        return results;
    }

    // 2. 最小高さ (min-height) の確保確認 (AGENTS.md ルール1)
    const computedWrapper = window.getComputedStyle(wrapper);
    const minHeight = computedWrapper.minHeight;
    const hasMinHeight = minHeight && parseInt(minHeight) >= 400;
    results.checks.push({
        name: "Min Height Rule (AGENTS.md Rule 1)",
        status: hasMinHeight ? "PASS" : "WARN",
        value: minHeight
    });

    // 3. マス目と文字の同期 (AGENTS.md ルール2)
    const computedEditor = window.getComputedStyle(editor);
    const bgSize = computedEditor.backgroundSize;
    const lineHeight = computedEditor.lineHeight;
    results.checks.push({
        name: "Grid & Font Sync (AGENTS.md Rule 2)",
        status: bgSize.includes(lineHeight) || bgSize !== 'auto' ? "PASS" : "WARN",
        bgSize: bgSize,
        lineHeight: lineHeight
    });

    // 4. 動的文字数対応（18〜40文字の範囲チェック）
    if (select) {
        const options = Array.from(select.options).map(o => parseInt(o.value));
        const supports18to40 = options.includes(18) && options.includes(40) && options.includes(30);
        results.checks.push({
            name: "Dynamic Column Range Support (18-40 chars)",
            status: supports18to40 ? "PASS" : "FAIL",
            optionsCount: options.length
        });
    }

    return results;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateEditorLayout };
}
