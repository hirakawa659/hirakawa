/**
 * ゴミ箱管理・復元・完全消去
 */
import { escapeHtml, getStoryPlainText } from '../utils/text.js';
import { d, s } from '../data/storage.js';

export function updateTrashCount() {
    if (!d.trash) d.trash = [];
    let count = d.trash.length;
    let badge = document.getElementById('sidebarTrashCount');
    if (badge) {
        badge.textContent = count > 0 ? `(${count})` : '';
        badge.style.color = count > 0 ? '#dc2626' : '#94a3b8';
        badge.style.fontSize = '10px';
        badge.style.marginLeft = '2px';
        badge.style.fontWeight = 'bold';
    }
}

export function openTrashModal() {
    let modal = document.getElementById('trashModal');
    if (modal) {
        modal.style.display = 'flex';
        renderTrashList();
    }
}

export function closeTrashModal() {
    let modal = document.getElementById('trashModal');
    if (modal) modal.style.display = 'none';
}

export function cloneItemWithNewIds(it) {
    let ni = {
        id: (it.type === 'folder' ? 'f_' : 'd_') + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: it.type,
        name: it.name || (it.type === 'folder' ? '無題フォルダ' : '無題')
    };
    if (it.type === 'file') {
        ni.content = it.content || '<div><br></div>';
    } else if (it.children && Array.isArray(it.children)) {
        ni.children = it.children.map(cloneItemWithNewIds);
    } else {
        ni.children = [];
    }
    return ni;
}

export function restoreTrashItem(idx) {
    if (!d.trash || !d.trash[idx]) return;
    let target = d.trash[idx];
    let restored = cloneItemWithNewIds(target);
    d.r.push(restored);
    d.trash.splice(idx, 1);
    s();
    if (typeof window.r === 'function') window.r();
    updateTrashCount();
    if (window.currentViewMode === 'shelf' && typeof window.renderShelfView === 'function') {
        window.renderShelfView();
    }
    renderTrashList();
}

export function deleteSingleTrashItem(idx) {
    if (!d.trash || !d.trash[idx]) return;
    let target = d.trash[idx];
    let msg = `「${target.name || '無題'}」を完全に削除しますか？\n\n※この操作は取り消せず、二度と復元できなくなります。`;
    if (!confirm(msg)) return;
    d.trash.splice(idx, 1);
    s();
    updateTrashCount();
    renderTrashList();
}

export function emptyAllTrash() {
    if (!d.trash || d.trash.length === 0) {
        alert('ゴミ箱はすでに空です。');
        return;
    }
    let msg = `ゴミ箱内のすべての項目（${d.trash.length}件）を完全に削除しますか？\n\n※完全に削除されたデータは二度と復元できません。`;
    if (!confirm(msg)) return;
    d.trash = [];
    s();
    updateTrashCount();
    renderTrashList();
    alert('ゴミ箱を完全に空にしました。');
}

export function renderTrashList() {
    let cont = document.getElementById('trashListContainer');
    let summaryEl = document.getElementById('trashCountSummary');
    let emptyBtn = document.getElementById('emptyTrashBtn');
    if (!cont) return;
    if (!d.trash) d.trash = [];

    let count = d.trash.length;
    if (summaryEl) summaryEl.textContent = `保管中の項目: ${count}件`;
    if (emptyBtn) {
        emptyBtn.disabled = (count === 0);
        emptyBtn.style.opacity = (count === 0) ? '0.5' : '1';
        emptyBtn.style.cursor = (count === 0) ? 'not-allowed' : 'pointer';
    }

    updateTrashCount();

    if (count === 0) {
        cont.innerHTML = `
            <div style="text-align:center;padding:32px 12px;color:#94a3b8;font-size:12px;background:#f8fafc;border-radius:6px;border:1px dashed #cbd5e1">
                ゴミ箱は空です
            </div>
        `;
        return;
    }

    cont.innerHTML = '';
    d.trash.forEach((it, idx) => {
        let card = document.createElement('div');
        card.style.background = '#ffffff';
        card.style.border = '1px solid #e2e8f0';
        card.style.borderRadius = '6px';
        card.style.padding = '10px 12px';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'space-between';
        card.style.gap = '10px';

        let isF = (it.type === 'folder');
        let dateStr = it.deletedAt ? new Date(it.deletedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

        let detailStr = '';
        if (isF) {
            let countTotalFiles = (children) => {
                let cnt = 0;
                if (!children) return 0;
                children.forEach(c => {
                    if (c.type === 'file') cnt++;
                    else if (c.children) cnt += countTotalFiles(c.children);
                });
                return cnt;
            };
            let fc = countTotalFiles(it.children || []);
            detailStr = `フォルダ（紙 ${fc}枚）`;
        } else {
            let pure = getStoryPlainText(it.content || '').replace(/[\s\u3000]/g, '');
            detailStr = `紙（${pure.length.toLocaleString()}文字）`;
        }

        let infoDiv = document.createElement('div');
        infoDiv.style.flex = '1';
        infoDiv.style.minWidth = '0';
        infoDiv.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                <span style="font-size:10px;font-weight:bold;padding:1px 5px;border-radius:3px;background:${isF ? '#dbeafe' : '#fee2e2'};color:${isF ? '#1e40af' : '#991b1b'}">${isF ? 'フォルダ' : '紙'}</span>
                <span style="font-size:13px;font-weight:bold;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(it.name || '無題')}</span>
            </div>
            <div style="font-size:11px;color:#64748b;display:flex;align-items:center;gap:8px">
                <span>${detailStr}</span>
                ${dateStr ? `<span style="color:#94a3b8">• 削除: ${dateStr}</span>` : ''}
            </div>
        `;
        card.appendChild(infoDiv);

        let btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '6px';
        btnGroup.style.flexShrink = '0';

        let restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.innerHTML = '複製（復元）';
        restoreBtn.title = 'この項目を最上層に複製して復元';
        restoreBtn.style.background = '#f0fdf4';
        restoreBtn.style.border = '1px solid #86efac';
        restoreBtn.style.color = '#166534';
        restoreBtn.style.padding = '5px 8px';
        restoreBtn.style.borderRadius = '4px';
        restoreBtn.style.fontSize = '11px';
        restoreBtn.style.fontWeight = 'bold';
        restoreBtn.style.cursor = 'pointer';
        restoreBtn.onclick = () => restoreTrashItem(idx);
        btnGroup.appendChild(restoreBtn);

        let delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.innerHTML = '削除';
        delBtn.title = 'この項目を完全に削除';
        delBtn.style.background = '#fff5f5';
        delBtn.style.border = '1px solid #fecaca';
        delBtn.style.color = '#b91c1c';
        delBtn.style.padding = '5px 8px';
        delBtn.style.borderRadius = '4px';
        delBtn.style.fontSize = '11px';
        delBtn.style.fontWeight = 'bold';
        delBtn.style.cursor = 'pointer';
        delBtn.onclick = () => deleteSingleTrashItem(idx);
        btnGroup.appendChild(delBtn);

        card.appendChild(btnGroup);
        cont.appendChild(card);
    });
}
