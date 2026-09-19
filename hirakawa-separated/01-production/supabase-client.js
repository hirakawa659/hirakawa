/**
 * 01-PRODUCTION: Supabase Client Authentication & Cloud Sync Module
 * 
 * 責務: Production（本番サイト側のクライアント接続層）
 * 役割:
 *  - Supabase 外部サービス (03-external) との安全な通信（Anon Key + JWT）
 *  - ユーザー認証管理（サインアップ・ログイン・ログアウト・セッション監視）
 *  - 原稿データ（user_stories）およびユーザー設定（user_settings）の双方向同期
 *  - オフライン時／未ログイン時の localStorage フォールバック管理
 */

const SUPABASE_PROJECT_URL = "https://eqzyrsziwgmlanmztivu.supabase.co";
const SUPABASE_ANON_PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxenlyc3ppd2dtbGFubXp0aXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDE0NzgsImV4cCI6MjEwNTMxNzQ3OH0.ej_Yk_IHC1YimO_OzPUDpbF-XqHSM8XszyeD1LbJIdc";

let supabaseClient = null;
let currentUser = null;

/**
 * Supabaseクライアントインスタンスの取得
 */
function getSupabase() {
    if (!supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_PUBLIC_KEY);
        } catch(e) {
            console.error('Supabase initialization error:', e);
        }
    }
    return supabaseClient;
}

/**
 * 認証初期化 & セッション監視
 */
async function initSupabaseAuth(onUserChange) {
    const sb = getSupabase();
    if (!sb) return;

    try {
        const { data: { session } } = await sb.auth.getSession();
        currentUser = session ? session.user : null;
        if (typeof onUserChange === 'function') onUserChange(currentUser);

        sb.auth.onAuthStateChange((_event, session) => {
            currentUser = session ? session.user : null;
            if (typeof onUserChange === 'function') onUserChange(currentUser);
        });
    } catch(err) {
        console.error('Supabase getSession error:', err);
    }
}

/**
 * クラウドへの原稿データ同期
 */
async function syncDataToCloud(dataPayload) {
    const sb = getSupabase();
    if (!sb || !currentUser) return { success: false, reason: 'unauthenticated' };

    try {
        const { error } = await sb
            .from('user_stories')
            .upsert({
                user_id: currentUser.id,
                data: dataPayload,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) throw error;
        return { success: true };
    } catch(err) {
        console.error('Cloud sync push error:', err);
        return { success: false, error: err };
    }
}

/**
 * クラウドからの原稿データ取得
 */
async function pullDataFromCloud() {
    const sb = getSupabase();
    if (!sb || !currentUser) return null;

    try {
        const { data, error } = await sb
            .from('user_stories')
            .select('data, updated_at')
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data ? data.data : null;
    } catch(err) {
        console.error('Cloud sync pull error:', err);
        return null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getSupabase,
        initSupabaseAuth,
        syncDataToCloud,
        pullDataFromCloud,
        SUPABASE_PROJECT_URL
    };
}
