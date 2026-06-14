// ─── Supabase client & helpers ──────────────────────
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_CONFIG, EDGE_BASE } from './config.js';
import { state } from './state.js';

// ── Client singleton ─────────────────────────────────
export const supabase = createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY, {
  auth: {
    persistSession  : true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
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
