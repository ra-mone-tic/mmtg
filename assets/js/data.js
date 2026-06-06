// ─── Data loading & normalization ───────────────────
import { pad } from './helpers.js';
import { state } from './state.js';

// ── Утилиты дат ──────────────────────────────────────

export function normalizeDate(str) {
  if (!str) return str;
  const parts = str.split('.');
  if (parts.length !== 3) return str;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return str;
  return `${pad(d)}.${pad(m)}.${y}`;
}

export function parseDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split('.').map(Number);
  if (!y) return null;
  return new Date(y, m - 1, d);
}

// ── Нормализация событий ─────────────────────────────

export function normalizeEvent(e) {
  return {
    id            : e.id,
    title         : e.title,
    venue         : e.location || e.venue || e.address || '',
    address       : e.location || e.address || '',
    date          : e.date,
    time          : e.time || '',
    desc          : e.full_description || e.short_description || '',
    blocks        : Array.isArray(e.description_blocks) ? e.description_blocks : null,
    imageUrl      : e.imageUrl || null,
    lng           : e.lon,
    lat           : e.lat,
    contacts      : e.contacts || '',
    tags          : e.tags || [],
    tg_message_id : e.tg_message_id || null,
  };
}

// ── Фильтрация и поиск ───────────────────────────────

export function filterByDate(dateStr) {
  return state.rawAllEvents
    .filter(e => e.date === dateStr)
    .map(normalizeEvent);
}

/**
 * Возвращает все события для списка дат (или всех, если список пуст).
 */
export function filterByDates(dateList) {
  if (!dateList || !dateList.length) return [];
  const set = new Set(dateList);
  return state.rawAllEvents
    .filter(e => set.has(e.date))
    .map(normalizeEvent);
}

export function findNearestDate() {
  if (!state.rawAllEvents.length) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dates = [...new Set(state.rawAllEvents.map(e => e.date))]
    .filter(d => parseDate(d) !== null)
    .sort((a, b) => parseDate(a) - parseDate(b));
  for (const d of dates) {
    if (parseDate(d) >= today) return d;
  }
  return dates.at(-1) ?? null;
}

// ── Загрузка ─────────────────────────────────────────

export async function loadAllEvents() {
  try {
    const resp = await fetch('events.json');
    const data = await resp.json();
    state.rawAllEvents = data.map(e => ({ ...e, date: normalizeDate(e.date) }));
  } catch (e) {
    console.error('[MEOW] Ошибка загрузки событий:', e);
    state.rawAllEvents = [];
  }
  return state.rawAllEvents;
}
