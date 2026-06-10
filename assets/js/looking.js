// ─── Looking for company — «Ищу компанию» ──────────
import { supabase } from './supabase.js';
import { state } from './state.js';
import { isAuthed } from './auth.js';
import { showToast } from './toast.js';
import { TG } from './helpers.js';

// ══════════════════════════════════════════════════════
//  Post / Cancel
// ══════════════════════════════════════════════════════

/**
 * Создать запись «Ищу компанию» на событие.
 * @param {string} eventId
 * @param {string} text — комментарий
 * @returns {object|null} — созданная запись или null
 */
export async function postLooking(eventId, text = '') {
  if (!isAuthed()) { showToast('Войдите через Telegram'); return null; }

  try {
    // Удаляем предыдущую активную запись на это событие
    await supabase.from('looking_for_company')
      .delete()
      .eq('user_id', state.user.id)
      .eq('event_id', eventId);

    const { data, error } = await supabase
      .from('looking_for_company')
      .insert({
        user_id:   state.user.id,
        event_id:  eventId,
        text:      text.trim(),
        visible:   true,
      })
      .select()
      .single();

    if (error) throw error;
    TG()?.HapticFeedback?.notificationOccurred('success');
    showToast('🔍 Ищешь компанию!');
    return data;
  } catch (err) {
    console.warn('[MEOW] postLooking:', err.message);
    showToast('Ошибка');
    return null;
  }
}

/**
 * Отменить свою активную запись «Ищу компанию» на событие.
 */
export async function cancelLooking(eventId) {
  if (!isAuthed()) return false;

  try {
    const { error } = await supabase.from('looking_for_company')
      .delete()
      .eq('user_id', state.user.id)
      .eq('event_id', eventId);

    if (error) throw error;
    showToast('Отменено');
    return true;
  } catch (err) {
    console.warn('[MEOW] cancelLooking:', err.message);
    showToast('Ошибка');
    return false;
  }
}

/**
 * Проверить, ищет ли текущий пользователь компанию на событие.
 */
export async function isLooking(eventId) {
  if (!isAuthed()) return false;
  try {
    const { count } = await supabase
      .from('looking_for_company')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', state.user.id)
      .eq('event_id', eventId);
    return (count ?? 0) > 0;
  } catch { return false; }
}

// ══════════════════════════════════════════════════════
//  Get who's looking
// ══════════════════════════════════════════════════════

/**
 * Получить список людей, ищущих компанию на событие.
 * @returns {Array<{id, user_id, text, profiles}>}
 */
export async function getLookers(eventId) {
  try {
    const { data, error } = await supabase
      .from('looking_for_company')
      .select('id, user_id, text, created_at, profiles(id, first_name, last_name, username, photo_url)')
      .eq('event_id', eventId)
      .eq('visible', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data ?? []).map(r => ({ ...r, profile: r.profiles })).filter(r => r.profile);
  } catch (err) {
    console.warn('[MEOW] getLookers:', err.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════
//  Render section in detail modal
// ══════════════════════════════════════════════════════

/**
 * Рендерит секцию «Ищут компанию» + кнопка.
 * @param {HTMLElement} container — #detail-looking
 * @param {string} eventId
 */
export async function renderLookingSection(container, eventId) {
  if (!container) return;

  const lookers = await getLookers(eventId);
  const myLooking = await isLooking(eventId);

  let html = '';

  // Кнопка
  html += `<button class="looking-btn ${myLooking ? 'active' : ''}" data-event-id="${eventId}">
    ${myLooking ? '🔍 Ищешь компанию (отменить)' : '🔍 Ищу компанию'}
  </button>`;

  // Список
  if (lookers.length) {
    html += '<div class="looking-list">';
    for (const l of lookers) {
      const p = l.profile;
      const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
      const avatar = p.photo_url
        ? `<img src="${p.photo_url}" alt="${p.first_name}" loading="lazy">`
        : `<span>${initials}</span>`;
      const isSelf = state.user?.id === l.user_id;
      html += `<div class="looking-row ${isSelf ? 'is-self' : ''}">
        <div class="looking-avatar" data-uid="${p.id}">${avatar}</div>
        <div class="looking-info">
          <div class="looking-name">${p.first_name ?? ''}${p.last_name ? ' ' + p.last_name : ''}${isSelf ? ' (ты)' : ''}</div>
          ${l.text ? `<div class="looking-text">${_esc(l.text)}</div>` : ''}
        </div>
      </div>`;
    }
    html += '</div>';
  } else if (!myLooking) {
    html += '<p class="looking-empty">Пока никто не ищет компанию</p>';
  }

  container.innerHTML = html;

  // ── Bind events ──────────────────────────────────────
  const btn = container.querySelector('.looking-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (!isAuthed()) { showToast('Войдите через Telegram'); return; }
      if (myLooking) {
        await cancelLooking(eventId);
      } else {
        // Простой prompt для текста
        const text = prompt('Комментарий (необязательно):') ?? '';
        await postLooking(eventId, text);
      }
      renderLookingSection(container, eventId);
    });
  }

  // Клик по аватарке → mini card
  container.querySelectorAll('.looking-avatar[data-uid]').forEach(el => {
    el.addEventListener('click', () => {
      // Диспатчим событие для social.js openUserCard
      document.dispatchEvent(new CustomEvent('meow:open-user-card', { detail: { userId: el.dataset.uid } }));
    });
  });
}

// ── Helpers ──────────────────────────────────────────

const _ESC = { '&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;' };
function _esc(s) { return String(s || '').replace(/[&<>"']/g, ch => _ESC[ch]); }