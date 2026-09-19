/**
 * DOM操作・ドラッグ＆ドロップ用ゴースト要素ユーティリティ
 */
import { escapeHtml } from './text.js';

export function getOrCreateDragGhost() {
    let ghost = document.getElementById('treeDragGhost');
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = 'treeDragGhost';
        ghost.className = 'tree-drag-ghost';
        ghost.style.display = 'none';
        document.body.appendChild(ghost);
    }
    return ghost;
}

export function hideDragGhost() {
    let ghost = document.getElementById('treeDragGhost');
    if (ghost) ghost.style.display = 'none';
}
