// ─── Auth — Telegram initData verification & session ─
import { supabase, callEdge, getSession } from './supabase.js';
import { EDGE_BASE } from './config.js';
import { state } from './state.js';
import { TG } from './helpers.js';

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
        const { data: adminRow } = await supabase
          .from('admin_roles').select('role').eq('user_id', existing.user.id).maybeSingle();
        state.user = { ...profile, is_admin: !!adminRow };
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
    if (!initData) {
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
    const { data: adminRow } = await supabase
      .from('admin_roles').select('role').eq('user_id', result.profile.id).maybeSingle();

    state.user = { ...result.profile, is_admin: !!adminRow };
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
