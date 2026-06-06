// ─── Places module ───────────────────────────────────
import { state } from './state.js';
import { normalizeEvent, parseDate } from './data.js';

/**
 * Загружает places.json и сохраняет в state.rawPlaces.
 * Возвращает промис с массивом мест.
 */
export async function loadPlaces() {
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

/**
 * Поиск места по id.
 */
export function getPlaceById(id) {
  return state.rawPlaces.find(p => p.id === id) || null;
}

/**
 * Поиск мест по имени (case-insensitive).
 */
export function searchPlaces(query) {
  if (!query?.trim()) return [];
  const q = query.toLowerCase().trim();
  return state.rawPlaces.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.address || '').toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q)
  );
}

/**
 * Найти предстоящие мероприятия для данного места.
 * Использует place.keywords[] для нечёткого совпадения с event.location.
 * Возвращает нормализованные события с датой >= сегодня, отсортированные по дате.
 */
export function getEventsForPlace(place) {
  if (!place?.keywords?.length) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return state.rawAllEvents
    .filter(e => {
      const loc = (e.location || e.venue || '').toLowerCase();
      return place.keywords.some(kw => loc.includes(kw.toLowerCase()));
    })
    .filter(e => {
      const d = parseDate(e.date);
      return d !== null && d >= today;
    })
    .map(normalizeEvent)
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
}