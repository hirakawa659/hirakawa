/**
 * Supabase 認証・アカウント管理・パスワードリセット
 */
import { pushToCloud, pullFromCloud, formatSyncDate } from './sync.js';

export const SUPABASE_PROJECT_URL = "https://eqzyrsziwgmlanmztivu.supabase.co";
export const SUPABASE_ANON_PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxenlyc3ppd2dtbGFubXp0aXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDE0NzgsImV4cCI6MjEwNTMxNzQ3OH0.ej_Yk_IHC1YimO_OzPUDpbF-XqHSM8XszyeD1LbJIdc";

export let supabaseClient = null;
export let currentUser = null;
export let currentSyncTab = 'login';
export let isPasswordRecoveryMode = false;

export function getSupabase() {
    if (!supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_PUBLIC_KEY);
        } catch (e) {
            console.error('Supabase init error:', e);
        }
    }
    return supabaseClient;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export function setPasswordRecoveryMode(val) {
    isPasswordRecoveryMode = val;
    window.isPasswordRecoveryMode = val;
}

export async function initSupabaseAuth() {
    const sb = getSupabase();
    if (!sb) return;

    setPasswordRecoveryMode(false);

    const fullUrl = window.location.href;
    const hashStr = window.location.hash || '';
    const searchStr = window.location.search || '';
    const isRecoveryUrl = fullUrl.includes('type=recovery') ||
                          hashStr.includes('type=recovery') ||
                          searchStr.includes('type=recovery') ||
                          hashStr.includes('access_token') ||
                          searchStr.includes('access_token') ||
                          searchStr.includes('token_hash') ||
                          searchStr.includes('code=');

    const triggerRecoveryUi = () => {
        setPasswordRecoveryMode(true);
        openSyncModal();
        switchSyncTab('reset_password');
        showAuthMsg('新しいパスワードを入力して再設定を完了してください。', false);
    };

    if (isRecoveryUrl) {
        triggerRecoveryUi();
        setTimeout(triggerRecoveryUi, 50);
        setTimeout(triggerRecoveryUi, 300);
        setTimeout(triggerRecoveryUi, 800);
    }

    sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            triggerRecoveryUi();
            return;
        }
        const prevUser = currentUser;
        currentUser = session ? session.user : null;
        if (isPasswordRecoveryMode || isRecoveryUrl) {
            triggerRecoveryUi();
            return;
        }
        updateSyncUiState();
        if (event === 'SIGNED_IN' && currentUser && (!prevUser || prevUser.id !== currentUser.id)) {
            await pullFromCloud(false);
        }
    });

    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
            currentUser = session.user;
            if (!isPasswordRecoveryMode && !isRecoveryUrl) {
                updateSyncUiState();
                await pullFromCloud(false);
            }
        } else {
            currentUser = null;
            if (!isPasswordRecoveryMode && !isRecoveryUrl) {
                updateSyncUiState();
            }
        }
    } catch (err) {
        console.error('Session error:', err);
    }
}

export function updateSyncUiState(lastSyncTimestamp = null) {
    const iconEl = document.getElementById('toolSyncStatusIcon');
    const textEl = document.getElementById('toolSyncStatusText');
    const loggedInView = document.getElementById('syncLoggedInView');
    const loggedOutView = document.getElementById('syncLoggedOutView');
    const emailEl = document.getElementById('syncUserEmail');
    const badgeEl = document.getElementById('syncStatusBadge');
    const lastTimeEl = document.getElementById('syncLastTimeText');

    if (isPasswordRecoveryMode) {
        if (loggedInView) loggedInView.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'flex';
        return;
    }

    if (currentUser) {
        if (iconEl) iconEl.textContent = '☁️';
        if (textEl) {
            textEl.textContent = '同期済';
            textEl.style.color = '#15803d';
        }
        if (loggedInView) loggedInView.style.display = 'flex';
        if (loggedOutView) loggedOutView.style.display = 'none';
        if (emailEl) emailEl.textContent = currentUser.email || 'ログイン中';
        if (badgeEl) {
            badgeEl.textContent = '☁️ 接続中 (自動同期有効)';
            badgeEl.style.color = '#15803d';
        }
        if (lastTimeEl) {
            lastTimeEl.textContent = lastSyncTimestamp ? `最終同期: ${formatSyncDate(lastSyncTimestamp)}` : '同期済み（クラウド接続中）';
        }
    } else {
        if (iconEl) iconEl.textContent = '☁️';
        if (textEl) {
            textEl.textContent = '未ログイン';
            textEl.style.color = '#64748b';
        }
        if (loggedInView) loggedInView.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'flex';
    }
}

export function setSyncStatusBadge(status, message, lastSyncTimestamp = null) {
    const iconEl = document.getElementById('toolSyncStatusIcon');
    const textEl = document.getElementById('toolSyncStatusText');
    const badgeEl = document.getElementById('syncStatusBadge');
    const lastTimeEl = document.getElementById('syncLastTimeText');

    if (!currentUser) {
        if (iconEl) iconEl.textContent = '☁️';
        if (textEl) {
            textEl.textContent = '未ログイン';
            textEl.style.color = '#64748b';
        }
        return;
    }

    if (status === 'syncing') {
        if (iconEl) iconEl.textContent = '⏳';
        if (textEl) {
            textEl.textContent = '同期中...';
            textEl.style.color = '#0284c7';
        }
        if (badgeEl) {
            badgeEl.textContent = '⏳ 同期中...';
            badgeEl.style.color = '#0284c7';
        }
    } else if (status === 'synced') {
        if (iconEl) iconEl.textContent = '☁️';
        if (textEl) {
            textEl.textContent = '同期済';
            textEl.style.color = '#15803d';
        }
        if (badgeEl) {
            badgeEl.textContent = '☁️ 同期完了';
            badgeEl.style.color = '#15803d';
        }
        if (lastTimeEl && lastSyncTimestamp) {
            lastTimeEl.textContent = `最終同期: ${formatSyncDate(lastSyncTimestamp)}`;
        }
    } else if (status === 'error') {
        if (iconEl) iconEl.textContent = '⚠️';
        if (textEl) {
            textEl.textContent = '同期失敗';
            textEl.style.color = '#dc2626';
        }
        if (badgeEl) {
            badgeEl.textContent = `⚠️ 同期エラー: ${message || ''}`;
            badgeEl.style.color = '#dc2626';
        }
    }
}

export function openSyncModal() {
    if (!isPasswordRecoveryMode) {
        updateSyncUiState();
    }
    const modal = document.getElementById('syncModal');
    if (modal) modal.style.display = 'flex';
}

export function closeSyncModal(force = false) {
    if (!force && (isPasswordRecoveryMode || currentSyncTab === 'reset_password')) {
        showAuthMsg('新しいパスワードを設定するまで閉じることはできません。パスワードを入力して更新してください。');
        return;
    }
    const modal = document.getElementById('syncModal');
    if (modal) modal.style.display = 'none';
    clearAuthMsg();
    if (currentSyncTab === 'forgot' || currentSyncTab === 'reset_password') {
        switchSyncTab('login');
    }
    if (isPasswordRecoveryMode) {
        setPasswordRecoveryMode(false);
        updateSyncUiState();
    }
}

export function switchSyncTab(tab) {
    if (isPasswordRecoveryMode && tab !== 'reset_password') {
        showAuthMsg('パスワードの再設定が完了するまで画面を切り替えることはできません。');
        return;
    }
    currentSyncTab = tab;
    const tabRow = document.getElementById('syncAuthTabRow');
    const loginBtn = document.getElementById('syncTabLoginBtn');
    const signupBtn = document.getElementById('syncTabSignupBtn');
    const forgotHeader = document.getElementById('syncForgotHeader');
    const forgotTitle = document.getElementById('syncForgotTitle');
    const forgotBackBtn = document.getElementById('syncForgotBackBtn');
    const modalCloseBtn = document.getElementById('syncModalCloseBtn');
    const noticeEl = document.getElementById('syncLoggedOutNotice');
    const emailRow = document.getElementById('syncAuthEmailRow');
    const emailInput = document.getElementById('syncAuthEmail');
    const passwordRow = document.getElementById('syncAuthPasswordRow');
    const passwordLabel = document.getElementById('syncAuthPasswordLabel');
    const passwordInput = document.getElementById('syncAuthPassword');
    const confirmRow = document.getElementById('syncAuthPasswordConfirmRow');
    const confirmLabel = document.getElementById('syncAuthPasswordConfirmLabel');
    const confirmInput = document.getElementById('syncAuthPasswordConfirm');
    const forgotRow = document.getElementById('syncForgotPasswordRow');
    const submitBtn = document.getElementById('syncAuthSubmitBtn');
    clearAuthMsg();

    if (modalCloseBtn) {
        modalCloseBtn.style.display = (tab === 'reset_password') ? 'none' : 'block';
    }

    if (tab === 'login') {
        if (tabRow) tabRow.style.display = 'flex';
        if (forgotHeader) forgotHeader.style.display = 'none';
        if (forgotBackBtn) forgotBackBtn.style.display = 'inline-block';
        if (noticeEl) {
            noticeEl.style.display = 'block';
            noticeEl.innerHTML = '未ログイン時はブラウザ内（ローカル）に保存されます。<br>ログインすると、別の端末やブラウザとも自動同期できます。';
        }
        if (loginBtn) { loginBtn.style.borderBottom = '2px solid #2563eb'; loginBtn.style.color = '#2563eb'; }
        if (signupBtn) { signupBtn.style.borderBottom = '2px solid transparent'; signupBtn.style.color = '#64748b'; }
        if (emailRow) emailRow.style.display = 'flex';
        if (passwordRow) passwordRow.style.display = 'flex';
        if (passwordLabel) passwordLabel.textContent = 'パスワード';
        if (confirmRow) confirmRow.style.display = 'none';
        if (forgotRow) forgotRow.style.display = 'flex';
        if (submitBtn) submitBtn.textContent = 'ログイン';
        if (emailInput) emailInput.required = true;
        if (passwordInput) passwordInput.required = true;
        if (confirmInput) confirmInput.required = false;
    } else if (tab === 'signup') {
        if (tabRow) tabRow.style.display = 'flex';
        if (forgotHeader) forgotHeader.style.display = 'none';
        if (forgotBackBtn) forgotBackBtn.style.display = 'inline-block';
        if (noticeEl) {
            noticeEl.style.display = 'block';
            noticeEl.innerHTML = 'アカウントを作成すると、クラウドに原稿が自動保存され、複数端末で同期できます。';
        }
        if (loginBtn) { loginBtn.style.borderBottom = '2px solid transparent'; loginBtn.style.color = '#64748b'; }
        if (signupBtn) { signupBtn.style.borderBottom = '2px solid #2563eb'; signupBtn.style.color = '#2563eb'; }
        if (emailRow) emailRow.style.display = 'flex';
        if (passwordRow) passwordRow.style.display = 'flex';
        if (passwordLabel) passwordLabel.textContent = 'パスワード';
        if (confirmRow) confirmRow.style.display = 'flex';
        if (confirmLabel) confirmLabel.textContent = 'パスワード（確認）';
        if (forgotRow) forgotRow.style.display = 'none';
        if (submitBtn) submitBtn.textContent = '新規アカウント作成';
        if (emailInput) emailInput.required = true;
        if (passwordInput) passwordInput.required = true;
        if (confirmInput) confirmInput.required = true;
    } else if (tab === 'forgot') {
        if (tabRow) tabRow.style.display = 'none';
        if (forgotHeader) forgotHeader.style.display = 'flex';
        if (forgotTitle) forgotTitle.textContent = 'パスワードの再設定';
        if (forgotBackBtn) forgotBackBtn.style.display = 'inline-block';
        if (noticeEl) {
            noticeEl.style.display = 'block';
            noticeEl.innerHTML = 'ご登録のメールアドレスを入力してください。<br>パスワード再設定用の案内メールをお送りします。';
        }
        if (emailRow) emailRow.style.display = 'flex';
        if (passwordRow) passwordRow.style.display = 'none';
        if (confirmRow) confirmRow.style.display = 'none';
        if (forgotRow) forgotRow.style.display = 'none';
        if (submitBtn) submitBtn.textContent = '再設定メールを送信';
        if (emailInput) { emailInput.required = true; emailInput.focus(); }
        if (passwordInput) passwordInput.required = false;
        if (confirmInput) confirmInput.required = false;
    } else if (tab === 'reset_password') {
        const loggedInView = document.getElementById('syncLoggedInView');
        const loggedOutView = document.getElementById('syncLoggedOutView');
        if (loggedInView) loggedInView.style.display = 'none';
        if (loggedOutView) loggedOutView.style.display = 'flex';

        if (tabRow) tabRow.style.display = 'none';
        if (forgotHeader) forgotHeader.style.display = 'flex';
        if (forgotTitle) forgotTitle.textContent = '新しいパスワードの設定（必須）';
        if (forgotBackBtn) forgotBackBtn.style.display = 'none';
        if (noticeEl) {
            noticeEl.style.display = 'block';
            noticeEl.innerHTML = '<span style="color:#b91c1c;font-weight:bold">※新しいパスワードの設定が必須です。</span><br>設定を完了するまでこの画面を閉じることはできません。<br>6文字以上の新しいパスワードを入力してください。';
        }
        if (emailRow) emailRow.style.display = 'none';
        if (passwordRow) passwordRow.style.display = 'flex';
        if (passwordLabel) passwordLabel.textContent = '新しいパスワード';
        if (passwordInput) { passwordInput.value = ''; passwordInput.required = true; }
        if (confirmRow) confirmRow.style.display = 'flex';
        if (confirmLabel) confirmLabel.textContent = '新しいパスワード（確認）';
        if (confirmInput) { confirmInput.value = ''; confirmInput.required = true; }
        if (forgotRow) forgotRow.style.display = 'none';
        if (submitBtn) submitBtn.textContent = 'パスワードを更新して完了';
        if (emailInput) emailInput.required = false;
    }
}

export function showAuthMsg(text, isError = true) {
    const msgEl = document.getElementById('syncAuthMsg');
    if (!msgEl) return;
    msgEl.style.display = 'block';
    msgEl.style.color = isError ? '#b91c1c' : '#15803d';
    msgEl.textContent = text;
}

export function clearAuthMsg() {
    const msgEl = document.getElementById('syncAuthMsg');
    if (!msgEl) return;
    msgEl.style.display = 'none';
    msgEl.textContent = '';
}

export function translateAuthError(msg) {
    if (!msg) return 'エラーが発生しました。';
    if (msg.includes('Invalid login credentials')) return 'メールアドレスまたはパスワードが間違っています。';
    if (msg.includes('User already registered')) return 'このメールアドレスは既に登録されています。';
    if (msg.includes('Password should be at least')) return 'パスワードは6文字以上必要です。';
    if (msg.includes('Email not confirmed')) return 'メールアドレスが確認されていません。受信トレイの認証リンクをご確認ください。';
    if (msg.includes('rate limit') || msg.includes('once every') || msg.includes('security purposes')) return 'セキュリティ保護のため、再試行までしばらく時間をおいてください。';
    if (msg.includes('User not found')) return 'このメールアドレスのアカウントが見つかりません。';
    if (msg.includes('should be different')) return '新しいパスワードは過去のものと異なるものを指定してください。';
    if (msg.includes('invalid format')) return '有効なメールアドレスを入力してください。';
    return msg;
}

export async function handleAuthSubmit(event) {
    if (event) event.preventDefault();
    const sb = getSupabase();
    if (!sb) {
        showAuthMsg('Supabase SDKの読み込みに失敗しました。');
        return;
    }
    const email = (document.getElementById('syncAuthEmail')?.value || '').trim();
    const password = document.getElementById('syncAuthPassword')?.value || '';
    const submitBtn = document.getElementById('syncAuthSubmitBtn');

    if (currentSyncTab === 'forgot') {
        if (!email) {
            showAuthMsg('メールアドレスを入力してください。');
            return;
        }
        try {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '送信中...'; }
            clearAuthMsg();
            const redirectUrl = window.location.origin + window.location.pathname;
            const { data, error } = await sb.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl
            });
            if (error) {
                showAuthMsg(translateAuthError(error.message));
            } else {
                showAuthMsg('パスワード再設定用のメールを送信しました。受信トレイのリンクから新しいパスワードを設定してください。', false);
            }
        } catch (err) {
            showAuthMsg('エラー: ' + err.message);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '再設定メールを送信'; }
        }
        return;
    }

    if (currentSyncTab === 'reset_password') {
        const confirmPass = document.getElementById('syncAuthPasswordConfirm')?.value || '';
        if (!password) {
            showAuthMsg('新しいパスワードを入力してください。');
            return;
        }
        if (password !== confirmPass) {
            showAuthMsg('パスワードが一致しません。');
            return;
        }
        if (password.length < 6) {
            showAuthMsg('パスワードは6文字以上で入力してください。');
            return;
        }
        try {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '更新中...'; }
            clearAuthMsg();
            const { data, error } = await sb.auth.updateUser({ password });
            if (error) {
                showAuthMsg(translateAuthError(error.message));
            } else {
                setPasswordRecoveryMode(false);
                currentSyncTab = 'login';
                if (window.location.hash) {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                }
                showAuthMsg('パスワードを更新しました！', false);
                if (data && data.user) currentUser = data.user;
                updateSyncUiState();
                setTimeout(() => closeSyncModal(true), 1500);
            }
        } catch (err) {
            showAuthMsg('エラー: ' + err.message);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'パスワードを更新して完了'; }
        }
        return;
    }

    if (!email || !password) {
        showAuthMsg('メールアドレスとパスワードを入力してください。');
        return;
    }

    if (currentSyncTab === 'signup') {
        const confirmPass = document.getElementById('syncAuthPasswordConfirm')?.value || '';
        if (password !== confirmPass) {
            showAuthMsg('パスワードが一致しません。');
            return;
        }
        if (password.length < 6) {
            showAuthMsg('パスワードは6文字以上で入力してください。');
            return;
        }

        try {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '登録中...'; }
            clearAuthMsg();
            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) {
                showAuthMsg(translateAuthError(error.message));
            } else if (data && data.user && data.session) {
                currentUser = data.user;
                updateSyncUiState();
                await pushToCloud();
                showAuthMsg('登録とログインが完了しました！', false);
                setTimeout(closeSyncModal, 1000);
            } else if (data && data.user && !data.session) {
                showAuthMsg('確認用メールを送信しました。受信トレイをご確認の上、メール内のリンクをクリックしてください。', false);
            }
        } catch (err) {
            showAuthMsg('エラー: ' + err.message);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '新規アカウント作成'; }
        }
    } else {
        try {
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'ログイン中...'; }
            clearAuthMsg();
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) {
                showAuthMsg(translateAuthError(error.message));
            } else if (data && data.user) {
                currentUser = data.user;
                updateSyncUiState();
                await pullFromCloud(false);
                showAuthMsg('ログインしました！', false);
                setTimeout(closeSyncModal, 800);
            }
        } catch (err) {
            showAuthMsg('エラー: ' + err.message);
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'ログイン'; }
        }
    }
}

export async function handleSupabaseLogout() {
    const sb = getSupabase();
    if (!sb) return;
    if (!confirm('ログアウトしますか？\n（ログアウトしても端末内のデータは保持されます）')) return;
    try {
        await sb.auth.signOut();
        currentUser = null;
        updateSyncUiState();
        closeSyncModal();
    } catch (err) {
        alert('ログアウトエラー: ' + err.message);
    }
}
