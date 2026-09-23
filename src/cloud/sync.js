/**
 * クラウドデータ同期（更新比較・競合防止・自動保存・安全スナップショット）
 */
import {
    d,
    f,
    s,
    g,
    setGlobalData,
    setCurrentFileId,
    walkAllItems,
    getDeviceId,
    saveSafetySnapshot,
    getSafetySnapshots,
    restoreSafetySnapshot,
    getManuscriptStats,
    SCHEMA_VERSION
} from '../data/storage.js';
import { getSupabase, currentUser, setSyncStatusBadge } from './auth.js';

export let cloudSyncTimeout = null;
export let lastSyncTimestamp = null;
export let pendingConflictData = null;

export function formatSyncDate(dateVal) {
    if (!dateVal) return '-';
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return '-';
    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${Y}/${M}/${D} ${h}:${m}:${s}`;
}

/**
 * ローカルデータとクラウドデータの差分・更新日時比較
 * 判定結果:
 * - 'identical': 内容が完全に同一
 * - 'local_newer': ローカルのほうが新しい（安全にプッシュ可能）
 * - 'cloud_newer': クラウドのほうが新しい（安全にプル可能）
 * - 'conflict': 同時期に変更・競合状態（破棄せずユーザー選択または統合）
 */
export function compareLocalAndCloud(localData, cloudRecord) {
    if (!cloudRecord || !cloudRecord.data || !cloudRecord.data.d) {
        return { status: 'local_newer', reason: 'no_cloud_data' };
    }

    const cloudData = cloudRecord.data;
    const cloudD = cloudData.d;

    // 原稿ツリーJSONによる内容完全一致チェック
    const localJson = JSON.stringify(localData.r || []);
    const cloudJson = JSON.stringify(cloudD.r || []);
    if (localJson === cloudJson) {
        return { status: 'identical', reason: 'content_matched' };
    }

    // 初期状態・空原稿かどうかの判定
    const isLocalEmpty = (!localData.r || localData.r.length === 0 ||
        (localData.r.length === 1 && localData.r[0].id === 'd_default_root' &&
         (!localData.r[0].content || localData.r[0].content === '<div>　</div>' || localData.r[0].content === '<div><br></div>')));
    const isCloudEmpty = (!cloudD.r || cloudD.r.length === 0 ||
        (cloudD.r.length === 1 && cloudD.r[0].id === 'd_default_root' &&
         (!cloudD.r[0].content || cloudD.r[0].content === '<div>　</div>' || cloudD.r[0].content === '<div><br></div>')));

    if (isCloudEmpty && !isLocalEmpty) {
        return { status: 'local_newer', reason: 'cloud_is_empty' };
    }
    if (isLocalEmpty && !isCloudEmpty) {
        return { status: 'cloud_newer', reason: 'local_is_empty' };
    }

    // 更新日時・タイムスタンプ取得
    const localTimeMs = new Date(localData.updatedAt || localStorage.getItem('n_last_saved_time') || 0).getTime();
    const cloudTimeMs = new Date(cloudRecord.updated_at || cloudData.timestamp || (cloudD.updatedAt) || 0).getTime();
    const baseCloudSyncMs = parseInt(localStorage.getItem('n_base_cloud_sync_time') || '0', 10);
    const localDeviceId = getDeviceId();
    const cloudDeviceId = cloudData.deviceId || null;

    // 以前の同期基準点が存在する場合の確実な判定
    if (baseCloudSyncMs > 0) {
        const cloudChanged = (cloudTimeMs > baseCloudSyncMs + 1000);
        const localChanged = (localTimeMs > baseCloudSyncMs + 1000);

        if (cloudChanged && localChanged) {
            // 同一端末かつローカルが進行している場合
            if (cloudDeviceId && cloudDeviceId === localDeviceId && localTimeMs >= cloudTimeMs) {
                return { status: 'local_newer', reason: 'same_device_progression' };
            }
            return { status: 'conflict', reason: 'concurrent_modification' };
        } else if (cloudChanged && !localChanged) {
            return { status: 'cloud_newer', reason: 'cloud_updated_remote' };
        } else if (!cloudChanged && localChanged) {
            return { status: 'local_newer', reason: 'local_updated_offline' };
        }
    }

    // 基準点がない場合のタイムスタンプ差分比較
    const timeDiff = localTimeMs - cloudTimeMs;
    if (Math.abs(timeDiff) <= 3000) {
        // 3秒以内の僅差かつ内容相違は競合扱い
        return { status: 'conflict', reason: 'near_timestamps' };
    } else if (timeDiff > 3000) {
        return { status: 'local_newer', reason: 'local_timestamp_newer' };
    } else {
        return { status: 'cloud_newer', reason: 'cloud_timestamp_newer' };
    }
}

export function scheduleCloudSync() {
    if (!currentUser) return; // 未ログイン時は同期保留
    setSyncStatusBadge('syncing');
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
    cloudSyncTimeout = setTimeout(async () => {
        await pushToCloud(false);
    }, 1500);
}

/**
 * クラウドへの保存
 * @param {boolean} isForce 強制上書きフラグ（競合解決時や手動保存時）
 */
export async function pushToCloud(isForce = false) {
    const sb = getSupabase();
    if (!sb || !currentUser) return { success: false, reason: 'not_logged_in' };
    try {
        setSyncStatusBadge('syncing');

        // 楽観的排他チェック: 事前に他端末でクラウドが更新されていないか確認
        if (!isForce) {
            const baseCloudSyncMs = parseInt(localStorage.getItem('n_base_cloud_sync_time') || '0', 10);
            if (baseCloudSyncMs > 0) {
                const { data: remoteRecord } = await sb
                    .from('user_novels')
                    .select('data, updated_at')
                    .eq('user_id', currentUser.id)
                    .maybeSingle();

                if (remoteRecord && remoteRecord.data && remoteRecord.data.d) {
                    const comp = compareLocalAndCloud(d, remoteRecord);
                    if (comp.status === 'conflict') {
                        setSyncStatusBadge('conflict', '他端末で新しい更新が見つかりました');
                        saveSafetySnapshot('conflict_local_state');
                        openConflictModal(d, remoteRecord);
                        return { success: false, reason: 'conflict_detected' };
                    }
                }
            }
        }

        // 保存前の安全ローカルスナップショット
        saveSafetySnapshot('before_cloud_push');

        const l = document.getElementById('l');
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();
        const payload = {
            schemaVersion: SCHEMA_VERSION,
            deviceId: getDeviceId(),
            d: d,
            f: f,
            sw: (function(){ const n = parseInt(localStorage.getItem('n_w'), 10); return (!isNaN(n) && n >= 18 && n <= 100) ? n : 30; })(),
            timestamp: nowMs
        };

        const { error } = await sb
            .from('user_novels')
            .upsert({
                user_id: currentUser.id,
                data: payload,
                updated_at: nowIso
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('Supabase push error:', error);
            setSyncStatusBadge('error', error.message);
            return { success: false, error };
        } else {
            lastSyncTimestamp = new Date(nowIso);
            localStorage.setItem('n_base_cloud_sync_time', String(nowMs));
            setSyncStatusBadge('synced', null, lastSyncTimestamp);
            return { success: true };
        }
    } catch (err) {
        console.error('Supabase push exception:', err);
        setSyncStatusBadge('error', err.message);
        return { success: false, error: err };
    }
}

/**
 * クラウドからデータを取得・比較して安全に反映
 * @param {boolean} isManual 手動ボタンによる読み込みかどうか
 */
export async function pullFromCloud(isManual = false) {
    const sb = getSupabase();
    if (!sb || !currentUser) return;
    try {
        setSyncStatusBadge('syncing');
        const { data, error } = await sb
            .from('user_novels')
            .select('data, updated_at')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('Supabase pull error:', error);
            setSyncStatusBadge('error', error.message);
            if (isManual) alert('クラウドからのデータ取得に失敗しました: ' + error.message);
            return;
        }

        if (!data || !data.data || !data.data.d || !Array.isArray(data.data.d.r)) {
            // クラウドにデータがまだ存在しない場合はローカルデータを初登録
            await pushToCloud(true);
            return;
        }

        const comp = compareLocalAndCloud(d, data);

        if (comp.status === 'identical') {
            const cloudMs = new Date(data.updated_at || data.data.timestamp || Date.now()).getTime();
            localStorage.setItem('n_base_cloud_sync_time', String(cloudMs));
            lastSyncTimestamp = new Date(data.updated_at || Date.now());
            setSyncStatusBadge('synced', null, lastSyncTimestamp);
            if (isManual) alert('ローカルとクラウドの原稿データは完全に最新で一致しています。');
            return;
        }

        if (comp.status === 'local_newer') {
            // ローカルのほうが新しい場合：古いクラウドデータでローカルを上書きしない
            if (isManual) {
                const proceed = confirm(
                    '【安全確認】ローカル端末の原稿（最新）のほうがクラウドよりも新しい状態です。\n\n' +
                    '「OK」を押すと、ローカルの最新原稿をクラウドへ安全に同期保存します。\n' +
                    '（古いクラウドデータでローカルを上書きすることは防止されました）'
                );
                if (proceed) {
                    await pushToCloud(true);
                    alert('ローカルの最新原稿をクラウドに保存しました。');
                }
            } else {
                // 自動同期時：ローカルの最新状態をクラウドへ安全にプッシュ
                await pushToCloud(true);
            }
            return;
        }

        if (comp.status === 'cloud_newer') {
            // クラウドのほうが新しい場合：上書き直前のローカル状態をスナップショットに保存してから反映
            saveSafetySnapshot('before_cloud_pull');
            applyCloudDataToLocal(data);
            const cloudMs = new Date(data.updated_at || data.data.timestamp || Date.now()).getTime();
            localStorage.setItem('n_base_cloud_sync_time', String(cloudMs));
            lastSyncTimestamp = new Date(data.updated_at || Date.now());
            setSyncStatusBadge('synced', null, lastSyncTimestamp);
            if (isManual) {
                alert('クラウドから最新の原稿データを復元しました。\n（直前のローカル原稿は安全バックアップに自動保管されました）');
            }
            return;
        }

        if (comp.status === 'conflict') {
            // 競合状態（複数端末で同時期に変更あり）
            saveSafetySnapshot('conflict_local_state');
            setSyncStatusBadge('conflict', '競合を検出しました');
            openConflictModal(d, data);
        }
    } catch (err) {
        console.error('Supabase pull exception:', err);
        setSyncStatusBadge('error', err.message);
        if (isManual) alert('エラーが発生しました: ' + err.message);
    }
}

/**
 * クラウドデータをローカルに適用
 */
export function applyCloudDataToLocal(record) {
    if (!record || !record.data || !record.data.d) return;
    setGlobalData(record.data.d);

    if (record.data.f && g(record.data.f)) {
        setCurrentFileId(record.data.f);
    } else {
        let firstFile = null;
        walkAllItems(it => {
            if (!firstFile && it.type === 'file') firstFile = it.id;
        });
        if (firstFile) setCurrentFileId(firstFile);
    }
    s();

    const l = document.getElementById('l');
    if (record.data.sw && l) {
        l.value = record.data.sw;
        localStorage.setItem('n_w', String(record.data.sw));
        if (typeof window.updateColsDisplay === 'function') window.updateColsDisplay();
    }
    if (typeof window.r === 'function') window.r();
    if (typeof window.o === 'function' && f) window.o(f);
    if (typeof window.updateCurrentStoryDisplay === 'function') window.updateCurrentStoryDisplay();
}

/**
 * 競合解決アクションの実行
 * @param {'merge_both' | 'keep_local' | 'keep_cloud'} mode
 * @param {object} cloudRecord
 */
export async function resolveConflict(mode, cloudRecord = pendingConflictData) {
    if (!cloudRecord || !cloudRecord.data) return;

    if (mode === 'merge_both') {
        // 両方を安全に保持して統合
        saveSafetySnapshot('before_merge_both');
        const cloudDateStr = formatSyncDate(cloudRecord.updated_at || cloudRecord.data.timestamp);
        const conflictFolder = {
            id: 'f_cloud_backup_' + Date.now(),
            type: 'folder',
            name: `📁 クラウド競合データ (${cloudDateStr})`,
            children: JSON.parse(JSON.stringify(cloudRecord.data.d.r || []))
        };
        if (!d.r) d.r = [];
        d.r.unshift(conflictFolder);
        s();
        saveSafetySnapshot('merged_both_result');
        await pushToCloud(true);
        if (typeof window.r === 'function') window.r();
        closeConflictModal();
        alert('両方の原稿データを統合しました！\n左側の原稿一覧の「📁 クラウド競合データ」から確認できます。');
    } else if (mode === 'keep_local') {
        // ローカル優先
        saveSafetySnapshot('cloud_overridden_by_local', cloudRecord.data.d);
        await pushToCloud(true);
        closeConflictModal();
        alert('ローカルの原稿データを優先してクラウドを更新しました。\n（クラウド版は安全バックアップに保管されました）');
    } else if (mode === 'keep_cloud') {
        // クラウド優先
        saveSafetySnapshot('local_overridden_by_cloud', d);
        applyCloudDataToLocal(cloudRecord);
        const cloudMs = new Date(cloudRecord.updated_at || cloudRecord.data.timestamp || Date.now()).getTime();
        localStorage.setItem('n_base_cloud_sync_time', String(cloudMs));
        lastSyncTimestamp = new Date(cloudRecord.updated_at || Date.now());
        setSyncStatusBadge('synced', null, lastSyncTimestamp);
        closeConflictModal();
        alert('クラウドの原稿データを復元しました。\n（直前のローカル原稿は安全バックアップに保管されました）');
    }
}

export async function manualPushToCloud() {
    const btn = document.getElementById('syncPushBtn');
    if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
    await pushToCloud(true);
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>今すぐクラウドへ保存（上書き）</span>'; }
    alert('クラウドに最新データを安全に保存しました。');
}

export async function manualPullFromCloud() {
    const btn = document.getElementById('syncPullBtn');
    if (btn) { btn.disabled = true; btn.textContent = '読み込み中...'; }
    await pullFromCloud(true);
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>クラウドから最新データを復元（読み込み）</span>'; }
}

/**
 * 競合モーダルの開閉と表示
 */
export function openConflictModal(localData, cloudRecord) {
    pendingConflictData = cloudRecord;
    const modal = document.getElementById('conflictModal');
    if (!modal) return;

    const localStats = getManuscriptStats(localData);
    const cloudStats = getManuscriptStats(cloudRecord.data ? cloudRecord.data.d : null);

    const localTimeEl = document.getElementById('conflictLocalTime');
    const localInfoEl = document.getElementById('conflictLocalInfo');
    const cloudTimeEl = document.getElementById('conflictCloudTime');
    const cloudInfoEl = document.getElementById('conflictCloudInfo');

    const localTimeMs = new Date(localData.updatedAt || localStorage.getItem('n_last_saved_time') || 0);
    const cloudTimeMs = new Date(cloudRecord.updated_at || cloudRecord.data?.timestamp || 0);

    if (localTimeEl) localTimeEl.textContent = formatSyncDate(localTimeMs);
    if (localInfoEl) {
        localInfoEl.textContent = `${localStats.fileCount}枚 (${localStats.totalChars.toLocaleString()}文字) - 「${localStats.sampleTitle || '無題'}」`;
    }

    if (cloudTimeEl) cloudTimeEl.textContent = formatSyncDate(cloudTimeMs);
    if (cloudInfoEl) {
        cloudInfoEl.textContent = `${cloudStats.fileCount}枚 (${cloudStats.totalChars.toLocaleString()}文字) - 「${cloudStats.sampleTitle || '無題'}」`;
    }

    modal.style.display = 'flex';
}

export function closeConflictModal() {
    const modal = document.getElementById('conflictModal');
    if (modal) modal.style.display = 'none';
}

/**
 * 安全バックアップ（スナップショット）一覧モーダル
 */
export function openSafetySnapshotsModal() {
    const modal = document.getElementById('snapshotModal');
    const listEl = document.getElementById('snapshotListContainer');
    if (!modal || !listEl) return;

    const snapshots = getSafetySnapshots();
    listEl.innerHTML = '';

    if (snapshots.length === 0) {
        listEl.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;font-size:12px">安全バックアップはまだ作成されていません。</div>';
    } else {
        snapshots.forEach((snap, idx) => {
            const card = document.createElement('div');
            card.style.cssText = 'background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px';
            
            let reasonLabel = '自動保存';
            if (snap.reason === 'before_cloud_pull') reasonLabel = 'クラウド読み込み前';
            if (snap.reason === 'before_cloud_push') reasonLabel = 'クラウド保存前';
            if (snap.reason === 'conflict_local_state') reasonLabel = '競合検出時の退避';
            if (snap.reason === 'local_overridden_by_cloud') reasonLabel = 'クラウド復元による退避';
            if (snap.reason === 'cloud_overridden_by_local') reasonLabel = 'ローカル優先による退避';
            if (snap.reason === 'before_merge_both') reasonLabel = '競合統合前';

            card.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:2px;overflow:hidden">
                    <div style="display:flex;align-items:center;gap:6px">
                        <span style="font-size:11.5px;font-weight:bold;color:#1e293b">${formatSyncDate(snap.timestamp)}</span>
                        <span style="background:#e0e7ff;color:#3730a3;font-size:9.5px;padding:1px 5px;border-radius:3px;font-weight:bold">${reasonLabel}</span>
                    </div>
                    <div style="font-size:11px;color:#475569">
                        <span>${snap.fileCount || 0}枚</span> / <span>${(snap.totalChars || 0).toLocaleString()}文字</span> - <span style="font-weight:500;color:#1e293b">${snap.sampleTitle || '無題'}</span>
                    </div>
                </div>
                <button type="button" onclick="execRestoreSnapshot('${snap.id}')" style="background:#2563eb;color:#ffffff;border:none;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:bold;cursor:pointer;white-space:nowrap;flex-shrink:0">
                    復元
                </button>
            `;
            listEl.appendChild(card);
        });
    }

    modal.style.display = 'flex';
}

export function closeSafetySnapshotsModal() {
    const modal = document.getElementById('snapshotModal');
    if (modal) modal.style.display = 'none';
}

export function execRestoreSnapshot(snapshotId) {
    if (!confirm('この安全バックアップ時点の原稿状態を復元しますか？\n（現在の状態も新しいバックアップとして退避されます）')) return;
    const ok = restoreSafetySnapshot(snapshotId);
    if (ok) {
        closeSafetySnapshotsModal();
        alert('指定したバックアップから原稿を復元しました。');
    } else {
        alert('バックアップの復元に失敗しました。');
    }
}

