// ─── Auth — Telegram initData verification & session ─
import { supabase, callEdge, getSession } from './supabase.js';
import { EDGE_BASE } from './config.js';
import { state } from './state.js';
import { TG } from './helpers.js';

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

async function _doInit() {
  // ── Попробуем восстановить сессию из localStorage ─
  try {
    const existing = await getSession();
    if (existing?.user?.id) {
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', existing.user.id)
        .single();
      if (profile) {
        state.user = { ...profile, is_admin: await _checkAdmin() };
        console.info('[MEOW] Auth restored from session');
        return state.user;
      }
      // Profile not found for this session — session is stale, fall through
      console.warn('[MEOW] Session exists but profile not found, re-authenticating');
    }
  } catch (err) {
    console.warn('[MEOW] Session restore failed, re-authenticating:', err.message);
  }

  // ── Telegram initData (только в Mini App) ────────
  try {
    const webapp   = TG();
    const initData = webapp?.initData;
    const tgUser   = webapp?.initDataUnsafe?.user;

    // Если initData пуст — пытаемся войти напрямую (Telegram Desktop fallback)
    if (!initData) {
      if (tgUser) {
        console.info('[MEOW] No initData but tgUser found — trying direct auth');
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
          if (!res.ok || !result.session) {
            console.warn('[MEOW] Direct auth failed:', result.error);
          } else {
            await supabase.auth.setSession({
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token,
            });
            state.user = { ...result.profile, is_admin: await _checkAdmin() };
            console.info('[MEOW] Direct auth fallback succeeded');
            return state.user;
          }
        } catch (e) {
          console.warn('[MEOW] Direct auth fallback failed:', e.message);
        }
      }
      console.info('[MEOW] No Telegram initData — running without auth');
      return null;
    }

    // ── Верификация через Edge Function ──────────────
    const res = await fetch(`${EDGE_BASE}/verify-telegram`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const result = await res.json();
    if (!res.ok || !result.session) {
      console.warn('[MEOW] Auth failed:', result.error);
      return null;
    }

    // ── Применяем сессию ─────────────────────────────
    await supabase.auth.setSession({
      access_token:  result.session.access_token,
      refresh_token: result.session.refresh_token,
    });

    // ── Проверка прав администратора ──────────────────
    state.user = { ...result.profile, is_admin: await _checkAdmin() };
    console.info('[MEOW] Authenticated via Telegram initData');
    return state.user;

  } catch (err) {
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
