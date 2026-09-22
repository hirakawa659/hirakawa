/**
 * カーソル制御・マス目クリック/タップ位置計算・選択範囲バッジ
 */
import { ensureGridLines } from './grid.js';
import { s } from '../data/storage.js';

export let lastHandleTime = 0;
export let lastTouchPos = null;
export let touchMoved = false;
export let touchStartScrollTop = 0;
export let touchHandled = false;

export function setCaretCharOffset(element, offset) {
    let range = document.createRange();
    let sel = window.getSelection();
    let currentOffset = 0;
    let found = false;

    function traverse(node) {
        if (found) return;
        if (node.nodeType === 3) {
            let textLen = node.textContent.length;
            if (currentOffset + textLen >= offset) {
                range.setStart(node, offset - currentOffset);
                range.collapse(true);
                found = true;
                return;
            }
            currentOffset += textLen;
        } else if (node.nodeType === 1) {
            if (node.nodeName === 'BR' && currentOffset === offset) {
                range.setStartBefore(node);
                range.collapse(true);
                found = true;
                return;
            }
            for (let child of node.childNodes) {
                traverse(child);
                if (found) return;
            }
        }
    }

    traverse(element);
    if (!found) {
        range.selectNodeContents(element);
        range.collapse(false);
    }
    if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

export function getCaretCharOffset(element) {
    let caretOffset = 0;
    let sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    let range = sel.getRangeAt(0);
    let preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    caretOffset = preCaretRange.toString().length;
    return caretOffset;
}

export function applyCaretToDiv(targetDiv, targetCol, maxCols) {
    if (!targetDiv) return;
    const mCont = document.querySelector('.m');
    const savedScrollTop = mCont ? mCont.scrollTop : 0;
    targetCol = Math.min(targetCol, maxCols);
    let lineText = targetDiv.textContent.replace(/\r?\n/g, '');
    let sel = window.getSelection();
    if (!sel) return;
    let range = document.createRange();

    if (lineText.length === 0) {
        // 空行の場合
        if (targetCol > 0) {
            // 指定のマス目（targetCol）まで全角スペースで埋めてカーソルを配置
            let pad = '　'.repeat(targetCol);
            let tn = document.createTextNode(pad);
            targetDiv.innerHTML = '';
            targetDiv.appendChild(tn);
            targetDiv.appendChild(document.createElement('br'));
            range.setStart(tn, targetCol);
            range.collapse(true);
        } else {
            let br = targetDiv.querySelector('br');
            if (!br) {
                targetDiv.innerHTML = '<br>';
                br = targetDiv.querySelector('br');
            }
            if (targetDiv.firstChild && targetDiv.firstChild.nodeType === 3) {
                range.setStart(targetDiv.firstChild, 0);
            } else if (br) {
                range.setStartBefore(br);
            } else {
                range.setStart(targetDiv, 0);
            }
            range.collapse(true);
        }
    } else {
        // すでに文字がある行の場合
        if (targetCol > lineText.length) {
            // 行末より右の空きマスをクリック：全角スペースで埋めてそのマス目にカーソル配置
            let padCount = targetCol - lineText.length;
            let pad = '　'.repeat(padCount);
            let tn = document.createTextNode(pad);
            let br = targetDiv.querySelector('br');
            if (br) {
                targetDiv.insertBefore(tn, br);
            } else {
                targetDiv.appendChild(tn);
            }
            range.setStart(tn, padCount);
            range.collapse(true);
        } else {
            // 文字の存在するマス目をクリック：その文字の位置へ
            setCaretCharOffset(targetDiv, targetCol);
            return;
        }
    }
    sel.removeAllRanges();
    sel.addRange(range);
    if (mCont && mCont.scrollTop !== savedScrollTop) {
        mCont.scrollTop = savedScrollTop;
    }
}

export function handleCellClick(ev) {
    const e = document.getElementById('e');
    const l = document.getElementById('l');
    if (!ev || !ev.target || !e) return;
    let sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    // エディタ本文（#e）の内側のみ反応
    if (!ev.target.closest('#e')) return;
    if (ev.target.closest('#n') || ev.target.closest('.l') || ev.target.closest('#linenumLeftToolBar')) return;
    if (ev.target.closest('#s') || ev.target.closest('.h') || ev.target.closest('#itemModal') || ev.target.closest('#repBar') || ev.target.closest('.modal-overlay') || ev.target.closest('button') || ev.target.closest('input') || ev.target.closest('select')) return;

    if (touchMoved && (Date.now() - (lastTouchPos?.time || 0) < 350)) return;

    let now = Date.now();
    if (now - lastHandleTime < 60) return;
    lastHandleTime = now;

    let clientX = ev.clientX;
    let clientY = ev.clientY;
    if ((clientX === undefined || clientX === 0) && lastTouchPos) {
        clientX = lastTouchPos.x;
        clientY = lastTouchPos.y;
    }
    if (clientX === undefined || clientY === undefined) return;

    let rect = e.getBoundingClientRect();
    let cs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cs')) || 32;
    let maxCols = parseInt(l ? l.value : '20') || 20;
    let padLeft = cs * 0.11;
    let clickX = clientX - rect.left - padLeft;
    let clickY = clientY - rect.top;

    ensureGridLines();
    let divs = e.querySelectorAll('#e>div');
    if (divs.length === 0) {
        e.innerHTML = '<div><br></div>';
        divs = e.querySelectorAll('#e>div');
    }

    if (clickY < 0) return;

    let targetRow = Math.max(0, Math.floor(clickY / cs));
    let targetCol = Math.max(0, Math.floor(clickX / cs));
    targetCol = Math.min(targetCol, maxCols);

    if (targetRow >= divs.length) {
        let lastDiv = divs[divs.length - 1];
        let lastText = lastDiv ? lastDiv.textContent.replace(/[\r\n]/g, '') : '';
        if (lastText.length > 0) {
            let nd = document.createElement('div');
            nd.innerHTML = '<br>';
            e.appendChild(nd);
            divs = e.querySelectorAll('#e>div');
            targetRow = divs.length - 1;
        } else {
            targetRow = divs.length - 1;
        }
        targetCol = 0;
    }

    let targetDiv = divs[targetRow];
    if (targetDiv) {
        const mCont = document.querySelector('.m');
        const savedScrollTop = mCont ? mCont.scrollTop : 0;
        if (document.activeElement !== e) {
            try {
                e.focus({ preventScroll: true });
            } catch (err) {
                e.focus();
            }
        }
        if (mCont && mCont.scrollTop !== savedScrollTop) {
            mCont.scrollTop = savedScrollTop;
        }
        applyCaretToDiv(targetDiv, targetCol, maxCols);
        if (typeof window.v === 'function') window.v();
        s();
        if (mCont && mCont.scrollTop !== savedScrollTop) {
            mCont.scrollTop = savedScrollTop;
        }
        if (mCont && savedScrollTop > 0) {
            requestAnimationFrame(() => {
                if (mCont && Math.abs(mCont.scrollTop - savedScrollTop) > 3) mCont.scrollTop = savedScrollTop;
            });
            setTimeout(() => {
                if (mCont && Math.abs(mCont.scrollTop - savedScrollTop) > 3) mCont.scrollTop = savedScrollTop;
            }, 40);
        }
    }
}

export function updateSelectionCountBadge() {
    const badge = document.getElementById('selectionCountBadge');
    if (!badge) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        badge.style.opacity = '0';
        badge.style.display = 'none';
        return;
    }
    const txt = sel.toString();
    const totalChars = txt.length;
    const pureChars = txt.replace(/[\s\u3000\r\n]/g, '').length;
    if (totalChars === 0) {
        badge.style.opacity = '0';
        badge.style.display = 'none';
        return;
    }
    badge.textContent = `選択中: ${totalChars}文字 (空白抜き: ${pureChars}字)`;
    badge.style.display = 'inline-flex';
    badge.style.opacity = '1';
}
