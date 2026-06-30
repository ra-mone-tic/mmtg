// ─── Auth — Telegram initData verification & session ─
import { supabase, callEdge, getSession } from './supabase.js';
import { EDGE_BASE } from './config.js';
import { state } from './state.js';
import { TG } from './helpers.js';

// ── Request ID для трассировки ────────────────────────
function makeRequestId() {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `auth_${ts}_${r}`;
}
const REQ_ID = makeRequestId();

// ── Диагностический логгер ───────────────────────────
function logStep(step, payload = {}) {
  const msg = `[AUTH_DIAG:${REQ_ID}] ${step}`;
  console.log(msg, JSON.stringify(payload));
}

/** Check admin via RPC (uses SECURITY DEFINER function, bypasses RLS) */
async function _checkAdmin() {
  try {
    const { data } = await supabase.rpc('is_admin');
    return !!data;
  } catch {
    return false;
  }
}

let _initPromise = null;

/**
 * Основная функция инициализации аутентификации.
 * Вызывается один раз в boot().
 * Возвращает профиль пользователя или null (без авторизации).
 */
export async function initAuth() {
  if (_initPromise) return _initPromise;
  _initPromise = _doInit();
  return _initPromise;
}

/**
 * Убедиться, что setSession реально сохранил сессию в storage.
 * На Telegram Desktop localStorage / sessionStorage могут не работать.
 */
async function _verifySessionPersisted(label) {
  logStep(`verify_persist_${label}`, {});
  try {
    const { data } = await supabase.auth.getSession();
    const ok = !!data?.session?.access_token;
    logStep(`verify_result_${label}`, { ok, hasSession: !!data?.session });
    return data?.session ?? null;
  } catch (err) {
    logStep(`verify_error_${label}`, { error: err.message });
    return null;
  }
}

// ── Подписка на события auth (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT) ──
let _authListenerAttached = false;
function _attachAuthListener() {
  if (_authListenerAttached) return;
  _authListenerAttached = true;
  supabase.auth.onAuthStateChange((event, session) => {
    logStep('onAuthStateChange', {
      event,
      hasSession: !!session,
      userId: session?.user?.id ?? null,
    });
  });
  logStep('auth_listener_attached', {});
}

async function _doInit() {
  logStep('init_start', {});
  _attachAuthListener();

  // ── Попробуем восстановить сессию из storage ─
  try {
    const existing = await getSession();
    logStep('restore_session', { found: !!existing?.user?.id });
    if (existing?.user?.id) {
      // profile и is_admin параллельно — экономим один RTT
      const [{ data: profile, error: profErr }, isAdmin] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', existing.user.id).single(),
        _checkAdmin(),
      ]);
      if (profile) {
        state.user = { ...profile, is_admin: isAdmin };
        logStep('restore_ok', { userId: existing.user.id });
        return state.user;
      }
      logStep('restore_stale', { userId: existing.user.id, profileErr: profErr?.message });
    }
  } catch (err) {
    logStep('restore_error', { error: err.message });
  }

  // ── Telegram initData (только в Mini App) ────────
  try {
    const webapp   = TG();
    const initData = webapp?.initData;
    const tgUser   = webapp?.initDataUnsafe?.user;

    logStep('tg_info', {
      hasInitData: !!initData,
      hasTgUser: !!tgUser,
      tgUserId: tgUser?.id ?? null,
      initDataLength: initData?.length ?? 0,
    });

    // Если initData пуст — пытаемся войти напрямую (Telegram Desktop fallback)
    if (!initData) {
      if (tgUser) {
        logStep('direct_auth_start', { tgId: tgUser.id });
        try {
          const res = await fetch(`${EDGE_BASE}/direct-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegram_id: tgUser.id,
              first_name: tgUser.first_name,
              last_name: tgUser.last_name,
              username: tgUser.username,
              photo_url: tgUser.photo_url,
            }),
          });
          const result = await res.json();
          logStep('direct_auth_response', { ok: res.ok, status: res.status, hasSession: !!result.session, error: result.error });
          if (!res.ok || !result.session) {
            logStep('direct_auth_failed', { error: result.error });
          } else {
            logStep('setSession_start', {});
            await supabase.auth.setSession({
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token,
            });
            logStep('setSession_done', {});

            // Немедленная проверка, что сессия сохранилась
            const persisted = await _verifySessionPersisted('direct');
            if (!persisted) {
              logStep('session_not_persisted', {});
              // Пробуем ещё раз с задержкой (storage может писаться асинхронно)
              await new Promise(r => setTimeout(r, 300));
              const retry = await _verifySessionPersisted('direct_retry');
              if (!retry) {
                logStep('session_not_persisted_final', {});
                console.warn('[MEOW] Desktop: session did NOT persist in storage, but proceeding with in-memory');
              }
            }

            state.user = { ...result.profile, is_admin: await _checkAdmin() };
            logStep('direct_auth_ok', { userId: state.user?.id });
            return state.user;
          }
        } catch (e) {
          logStep('direct_auth_error', { error: e.message });
        }
      }
      logStep('no_auth', { reason: 'no initData and no tgUser' });
      return null;
    }

    // ── Верификация через Edge Function ──────────────
    logStep('verify_start', {});
    const res = await fetch(`${EDGE_BASE}/verify-telegram`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const result = await res.json();
    logStep('verify_response', { ok: res.ok, status: res.status, hasSession: !!result.session, error: result.error });
    if (!res.ok || !result.session) {
      logStep('verify_failed', { error: result.error });
      return null;
    }

    // ── Применяем сессию ─────────────────────────────
    logStep('setSession_start', {});
    await supabase.auth.setSession({
      access_token:  result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    logStep('setSession_done', {});

    // Проверка сохранения
    const persisted = await _verifySessionPersisted('verify');
    if (!persisted) {
      logStep('session_not_persisted_verify', {});
    }

    // ── Проверка прав администратора ──────────────────
    state.user = { ...result.profile, is_admin: await _checkAdmin() };
    logStep('verify_ok', { userId: state.user?.id });
    return state.user;

  } catch (err) {
    logStep('init_auth_fatal', { error: err.message });
    console.error('[MEOW] initAuth error:', err);
    return null;
  }
}

export function getCurrentUser() {
  return state.user;
}

export function isAdmin() {
  return state.user?.is_admin === true;
}

export function isAuthed() {
  return state.user !== null;
}
