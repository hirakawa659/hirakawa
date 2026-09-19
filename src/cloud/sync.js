/**
 * クラウドデータ同期（自動保存・手動プッシュ/プル・タイムスタンプ管理）
 */
import { d, f, s, g, setGlobalData, setCurrentFileId } from '../data/storage.js';
import { getSupabase, currentUser, setSyncStatusBadge } from './auth.js';

export let cloudSyncTimeout = null;
export let lastSyncTimestamp = null;

export function formatSyncDate(d) {
    if (!d) return '-';
    const date = new Date(d);
    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${Y}/${M}/${D} ${h}:${m}:${s}`;
}

export function scheduleCloudSync() {
    if (!currentUser) return; // 未ログイン時は同期制限
    setSyncStatusBadge('syncing');
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
    cloudSyncTimeout = setTimeout(async () => {
        await pushToCloud();
    }, 1500);
}

export async function pushToCloud() {
    const sb = getSupabase();
    if (!sb || !currentUser) return;
    try {
        setSyncStatusBadge('syncing');
        const l = document.getElementById('l');
        const payload = {
            d: d,
            f: f,
            sw: (l ? l.value : '30'),
            timestamp: Date.now()
        };
        const { error } = await sb
            .from('user_novels')
            .upsert({
                user_id: currentUser.id,
                data: payload,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('Supabase push error:', error);
            setSyncStatusBadge('error', error.message);
        } else {
            lastSyncTimestamp = new Date();
            setSyncStatusBadge('synced', null, lastSyncTimestamp);
        }
    } catch (err) {
        console.error('Supabase push exception:', err);
        setSyncStatusBadge('error', err.message);
    }
}

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

        if (data && data.data && data.data.d && Array.isArray(data.data.d.r)) {
            setGlobalData(data.data.d);
            if (data.data.f) setCurrentFileId(data.data.f);
            s();

            const l = document.getElementById('l');
            if (data.data.sw && l) {
                l.value = data.data.sw;
                localStorage.setItem('n_w', String(data.data.sw));
                if (typeof window.updateColsDisplay === 'function') window.updateColsDisplay();
            }
            if (typeof window.r === 'function') window.r();
            if (typeof window.o === 'function') window.o(f);
            if (typeof window.updateCurrentStoryDisplay === 'function') window.updateCurrentStoryDisplay();

            lastSyncTimestamp = data.updated_at ? new Date(data.updated_at) : new Date();
            setSyncStatusBadge('synced', null, lastSyncTimestamp);
            if (isManual) alert('クラウドから最新データを復元しました。');
        } else {
            // クラウドにデータがまだ無い場合はローカルデータを初登録
            await pushToCloud();
        }
    } catch (err) {
        console.error('Supabase pull exception:', err);
        setSyncStatusBadge('error', err.message);
        if (isManual) alert('エラーが発生しました: ' + err.message);
    }
}

export async function manualPushToCloud() {
    const btn = document.getElementById('syncPushBtn');
    if (btn) { btn.disabled = true; btn.textContent = '保存中...'; }
    await pushToCloud();
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>今すぐクラウドへ保存（上書き）</span>'; }
    alert('クラウドに最新データを保存しました。');
}

export async function manualPullFromCloud() {
    if (!confirm('クラウドのデータで現在の原稿データを上書き復元しますか？')) return;
    const btn = document.getElementById('syncPullBtn');
    if (btn) { btn.disabled = true; btn.textContent = '読み込み中...'; }
    await pullFromCloud(true);
    if (btn) { btn.disabled = false; btn.innerHTML = '<span>クラウドから最新データを復元（読み込み）</span>'; }
}
