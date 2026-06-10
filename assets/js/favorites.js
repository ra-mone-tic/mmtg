// ─── Favorites ──────────────────────────────────────
import { supabase } from './supabase.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { isAuthed } from './auth.js';
import { TG } from './helpers.js';

// ── Загрузка ─────────────────────────────────────────

export async function loadFavorites() {
  if (!isAuthed()) return;
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('event_id')
      .eq('user_id', state.user.id);
    if (error) throw error;
    state.favoritedIds = new Set((data ?? []).map(r => r.event_id));
  } catch (err) {
    console.warn('[MEOW] loadFavorites:', err.message);
  }
}

// ── Переключение ─────────────────────────────────────

export async function toggleFavorite(eventId) {
  if (!isAuthed()) { showToast('Войдите через Telegram'); return false; }

  const was = state.favoritedIds.has(eventId);
  // Оптимистичное обновление
  if (was) state.favoritedIds.delete(eventId);
  else     state.favoritedIds.add(eventId);

  _updateFavButtons(eventId);

  try {
    if (was) {
      await supabase.from('favorites').delete()
        .eq('user_id', state.user.id).eq('event_id', eventId);
    } else {
      await supabase.from('favorites').insert({ user_id: state.user.id, event_id: eventId });
      TG()?.HapticFeedback?.notificationOccurred('success');
    }
    return !was;
  } catch (err) {
    // Откат
    if (was) state.favoritedIds.add(eventId);
    else     state.favoritedIds.delete(eventId);
    _updateFavButtons(eventId);
    showToast('Ошибка, попробуйте снова');
    return was;
  }
}

export function isFavorited(eventId) {
  return state.favoritedIds.has(eventId);
}

// ── Список избранного ─────────────────────────────────

export async function loadFavoritesList() {
  if (!isAuthed()) return [];
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('event_id, created_at, events(id, title, date, time, location, image_url, tags)')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => r.events).filter(Boolean);
  } catch (err) {
    console.warn('[MEOW] loadFavoritesList:', err.message);
    return [];
  }
}

// ── UI sync helpers ───────────────────────────────────

/** Обновляет все кнопки ❤️ для данного eventId на странице */
export function _updateFavButtons(eventId) {
  const faved = state.favoritedIds.has(eventId);
  document.querySelectorAll(`.btn-fav[data-event-id="${eventId}"]`).forEach(btn => {
    btn.classList.toggle('active', faved);
    btn.setAttribute('aria-label', faved ? 'Убрать из избранного' : 'В избранное');
    btn.title = faved ? 'Убрать из избранного' : 'В избранное';
  });
}

/** Рендерит кнопку ❤️ и вешает обработчик */
export function mountFavButton(container, eventId) {
  if (!container) return;
  const faved = state.favoritedIds.has(eventId);
  container.innerHTML = `
    <button class="btn-fav icon-btn${faved ? ' active' : ''}"
            data-event-id="${eventId}"
            aria-label="${faved ? 'Убрать из избранного' : 'В избранное'}"
            title="${faved ? 'Убрать из избранного' : 'В избранное'}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="${faved ? 'currentColor' : 'none'}"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>`;
  container.querySelector('.btn-fav').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    btn.style.transform = 'scale(1.3)';
    setTimeout(() => btn.style.transform = '', 200);
    await toggleFavorite(eventId);
    // Обновляем иконку
    const nowFaved = state.favoritedIds.has(eventId);
    btn.querySelector('path').setAttribute('fill', nowFaved ? 'currentColor' : 'none');
  });
}
