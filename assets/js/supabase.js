// ─── Supabase client & helpers ──────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_CONFIG, EDGE_BASE } from './config.js';
import { state } from './state.js';

// ── Custom storage with fallback ─────────────────────
// Telegram Desktop WebView часто блокирует localStorage.
// Пробуем localStorage → sessionStorage → in-memory Map.
function makeStorage() {
  const memory = new Map();
  const api = {
    getItem(key) {
      try { return localStorage.getItem(key); }
      catch {
        try { return sessionStorage.getItem(key); }
        catch { return memory.get(key) ?? null; }
      }
    },
    setItem(key, value) {
      try { localStorage.setItem(key, value); return; }
      catch {
        try { sessionStorage.setItem(key, value); return; }
        catch { memory.set(key, value); }
      }
    },
    removeItem(key) {
      try { localStorage.removeItem(key); }
      catch {
        try { sessionStorage.removeItem(key); }
        catch { memory.delete(key); }
      }
    },
  };
  // Проверка, работает ли localStorage вообще
  try {
    const k = '__storage_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    console.log('[MEOW] Storage: localStorage OK');
  } catch {
    console.warn('[MEOW] Storage: localStorage failed, fallback to ' +
      (typeof sessionStorage !== 'undefined' ? 'sessionStorage' : 'in-memory'));
  }
  return api;
}

const customStorage = makeStorage();

// ── Client singleton ─────────────────────────────────
export const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
  auth: {
    persistSession  : true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: customStorage,
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
});

// ── Session helpers ───────────────────────────────────

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function getUser() {
  return state.user;
}

export async function signOut() {
  await supabase.auth.signOut();
  state.user        = null;
  state.favoritedIds.clear();
  state.goingIds.clear();
  state.followingIds.clear();
  state.unreadNotifCount = 0;
}

// ── Edge function caller ──────────────────────────────

export async function callEdge(fn, body = {}) {
  const session = await getSession();
  const res = await fetch(`${EDGE_BASE}/${fn}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Edge ${fn} failed (${res.status})`);
  return data;
}

// ── Realtime subscription helper ─────────────────────

export function subscribeTable(table, filter, cb) {
  return supabase
    .channel(`${table}-changes`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table, filter },
      cb
    )
    .subscribe();
}
