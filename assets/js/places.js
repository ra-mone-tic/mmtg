// ─── Places module ───────────────────────────────────
import { state } from './state.js';
import { normalizeEvent, parseDate } from './data.js';
import { supabase } from './supabase.js';

export async function loadPlaces() {
  // ── Пробуем Supabase ──────────────────────────────
  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;
    if (data?.length) {
      state.rawPlaces = data.map(p => ({ ...p, imageUrl: p.image_url }));
      return state.rawPlaces;
    }
  } catch (err) {
    console.warn('[MEOW] Supabase places unavailable, falling back to JSON:', err.message);
  }

  // ── Fallback: локальный JSON ───────────────────────
  try {
    const resp = await fetch('places.json');
    const data = await resp.json();
    state.rawPlaces = data;
  } catch (e) {
    console.error('[MEOW] Ошибка загрузки places.json:', e);
    state.rawPlaces = [];
  }
  return state.rawPlaces;
}

export function getPlaceById(id) {
  return state.rawPlaces.find(p => p.id === id) || null;
}

export function searchPlaces(query) {
  if (!query?.trim()) return [];
  const q = query.toLowerCase().trim();
  return state.rawPlaces.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.address || '').toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q)
  );
}

export function getEventsForPlace(place) {
  if (!place?.keywords?.length) return [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return state.rawAllEvents
    .filter(e => {
      const loc = (e.location || e.venue || '').toLowerCase();
      return place.keywords.some(kw => loc.includes(kw.toLowerCase()));
    })
    .filter(e => { const d = parseDate(e.date); return d !== null && d >= today; })
    .map(normalizeEvent)
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
}
