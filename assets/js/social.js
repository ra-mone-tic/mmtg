// ─── Social: going / follow / friends / who's going ──
import { supabase, callEdge, subscribeTable } from './supabase.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { isAuthed } from './auth.js';
import { TG, $ } from './helpers.js';

// ══════════════════════════════════════════════════════
//  GOING (пойду)
// ══════════════════════════════════════════════════════

export async function loadGoing() {
  if (!isAuthed()) return;
  try {
    const { data } = await supabase
      .from('event_attendance')
      .select('event_id')
      .eq('user_id', state.user.id);
    state.goingIds = new Set((data ?? []).map(r => r.event_id));
  } catch (err) {
    console.warn('[MEOW] loadGoing:', err.message);
  }
}

export async function toggleGoing(eventId) {
  if (!isAuthed()) { showToast('Войдите через Telegram'); return false; }

  const was = state.goingIds.has(eventId);
  if (was) state.goingIds.delete(eventId);
  else     state.goingIds.add(eventId);
  _syncGoingButtons(eventId);

  try {
    if (was) {
      await supabase.from('event_attendance').delete()
        .eq('user_id', state.user.id).eq('event_id', eventId);
    } else {
      await supabase.from('event_attendance').insert({
        user_id: state.user.id,
        event_id: eventId,
        status: 'going',
        visible: state.user.show_going ?? true,
      });
      TG()?.HapticFeedback?.notificationOccurred('success');
      showToast('✅ Идёшь на мероприятие!');
    }
    // Сбрасываем кэш кто идёт для этого события
    state.goersCache.delete(eventId);
    return !was;
  } catch (err) {
    if (was) state.goingIds.add(eventId);
    else     state.goingIds.delete(eventId);
    _syncGoingButtons(eventId);
    showToast('Ошибка, попробуйте снова');
    return was;
  }
}

export function isGoing(eventId) {
  return state.goingIds.has(eventId);
}

// Загружает профили всех, кто идёт на мероприятие (с кешем)
export async function getGoers(eventId) {
  if (state.goersCache.has(eventId)) return state.goersCache.get(eventId);
  try {
    const { data } = await supabase
      .from('event_attendance')
      .select('user_id, visible, profiles(id, first_name, last_name, username, photo_url, level)')
      .eq('event_id', eventId)
      .eq('visible', true)
      .limit(30);
    const goers = (data ?? []).map(r => r.profiles).filter(Boolean);
    state.goersCache.set(eventId, goers);
    return goers;
  } catch (err) {
    console.warn('[MEOW] getGoers:', err.message);
    return [];
  }
}

// ── Realtime: обновлять список кто идёт ──────────────

export function subscribeGoers(eventId, onUpdate) {
  const channelName = `event_attendance-changes-${eventId}`;
  return supabase
    .channel(channelName)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'event_attendance', filter: `event_id=eq.${eventId}` },
      () => {
        state.goersCache.delete(eventId);
        onUpdate?.();
      }
    )
    .subscribe();
}

export function unsubscribeGoers(channel) {
  if (channel) supabase.removeChannel(channel);
}

// ══════════════════════════════════════════════════════
//  FOLLOW
// ══════════════════════════════════════════════════════

export async function loadFollowing() {
  if (!isAuthed()) return;
  try {
    const { data } = await supabase
      .from('follows')
      .select('target_id, target_type')
      .eq('follower_id', state.user.id);
    state.followingIds = new Set(
      (data ?? []).map(r => `${r.target_type}:${r.target_id}`)
    );
  } catch (err) {
    console.warn('[MEOW] loadFollowing:', err.message);
  }
}

export async function toggleFollow(targetId, targetType = 'user') {
  if (!isAuthed()) { showToast('Войдите через Telegram'); return false; }

  const key = `${targetType}:${targetId}`;
  const was = state.followingIds.has(key);

  if (was) state.followingIds.delete(key);
  else     state.followingIds.add(key);

  try {
    if (was) {
      await supabase.from('follows').delete()
        .eq('follower_id', state.user.id)
        .eq('target_id',   targetId)
        .eq('target_type', targetType);
    } else {
      await supabase.from('follows').insert({
        follower_id: state.user.id,
        target_id:   targetId,
        target_type: targetType,
        visible:     state.user.show_follow ?? true,
      });
      TG()?.HapticFeedback?.impactOccurred('medium');
    }
    return !was;
  } catch (err) {
    if (was) state.followingIds.add(key);
    else     state.followingIds.delete(key);
    showToast('Ошибка, попробуйте снова');
    return was;
  }
}

export function isFollowing(targetId, targetType = 'user') {
  return state.followingIds.has(`${targetType}:${targetId}`);
}

export async function isMutualFollow(userId) {
  if (!isAuthed() || !userId || userId === state.user.id) return false;
  try {
    const { count } = await supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .or(`user_a.eq.${state.user.id}.and.user_b.eq.${userId},user_a.eq.${userId}.and.user_b.eq.${state.user.id}`);
    return (count ?? 0) > 0;
  } catch { return false; }
}

// Загружает список друзей (взаимный фолоу)
export async function loadFriends(userId) {
  const uid = userId ?? state.user?.id;
  if (!uid) return [];
  try {
    const { data } = await supabase
      .from('friends')
      .select('user_a, user_b')
      .or(`user_a.eq.${uid},user_b.eq.${uid}`);

    if (!data?.length) return [];
    const friendIds = data.map(r => r.user_a === uid ? r.user_b : r.user_a);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username, photo_url, level')
      .in('id', friendIds);
    return profiles ?? [];
  } catch (err) {
    console.warn('[MEOW] loadFriends:', err.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════
//  WHO'S GOING — секция в detail
// ══════════════════════════════════════════════════════

/**
 * Рендерит секцию «Кто идёт» в контейнер.
 * container — HTMLElement
 */
export async function renderWhoGoing(container, eventId) {
  if (!container) return;
  container.innerHTML = '<p class="who-going-loading">…</p>';

  const goers = await getGoers(eventId);
  const going = isGoing(eventId);

  if (!goers.length && !going) {
    container.innerHTML = `
      <p class="who-going-empty">Будь первым, кто отметит «Пойду» 👋</p>`;
    return;
  }

  const myProfile = state.user;
  // Показываем себя первым если идём
  const list = going && myProfile
    ? [myProfile, ...goers.filter(g => g.id !== myProfile.id)]
    : goers;

  const avatarsHtml = list.slice(0, 8).map(p => _avatarHtml(p)).join('');
  const more = list.length > 8 ? `<span class="who-going-more">+${list.length - 8}</span>` : '';
  const label = going
    ? `Ты и ещё ${list.length - 1 > 0 ? list.length - 1 + ' человек' : 'никто'} идут`
    : `${list.length} ${_pluralize(list.length, 'человек', 'человека', 'человек')} идут`;

  container.innerHTML = `
    <div class="who-going-avatars">${avatarsHtml}${more}</div>
    <p class="who-going-label">${label}</p>`;

  // Клик по аватарке — открыть мини-профиль
  container.querySelectorAll('.who-going-avatar[data-uid]').forEach(el => {
    el.addEventListener('click', () => openUserCard(el.dataset.uid));
  });
}

function _avatarHtml(p) {
  const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
  const img = p.photo_url
    ? `<img src="${p.photo_url}" alt="${p.first_name}" loading="lazy">`
    : `<span>${initials}</span>`;
  return `<div class="who-going-avatar" data-uid="${p.id}" title="${p.first_name ?? ''}">
    ${img}</div>`;
}

// ══════════════════════════════════════════════════════
//  USER MINI CARD — попап при клике на аватарку
// ══════════════════════════════════════════════════════

export function openUserCard(userId) {
  const panel = $('user-mini-card');
  if (!panel) return;

  panel.dataset.userId = userId;
  panel.innerHTML = '<div class="user-card-loading">…</div>';
  panel.classList.add('open');

  _loadUserCard(userId, panel);
}

async function _loadUserCard(userId, panel) {
  try {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username, photo_url, level, bio, looking_for_company')
      .eq('id', userId)
      .single();
    if (!p) { panel.classList.remove('open'); return; }

    const { data: levelData } = await supabase
      .from('user_levels')
      .select('badge_emoji, badge_label')
      .eq('level', p.level)
      .single();

    const isSelf    = state.user?.id === userId;
    const following = isFollowing(userId);
    const isFriend  = await isMutualFollow(userId);

    const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
    const avatarHtml = p.photo_url
      ? `<img src="${p.photo_url}" alt="${p.first_name}" class="user-card-photo">`
      : `<div class="user-card-initials">${initials}</div>`;

    const friendBadge = isFriend
      ? `<span class="friend-badge">👥 Друзья</span>` : '';
    const levelBadge  = levelData
      ? `<span class="level-badge">${levelData.badge_emoji} ${levelData.badge_label}</span>` : '';

    panel.innerHTML = `
      <button class="user-card-close" id="btn-user-card-close" aria-label="Закрыть">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="user-card-top">
        ${avatarHtml}
        <div class="user-card-info">
          <div class="user-card-name">${p.first_name ?? ''}${p.last_name ? ' ' + p.last_name : ''}</div>
          <div class="user-card-badges">${levelBadge}${friendBadge}</div>
          ${p.bio ? `<div class="user-card-bio">${p.bio}</div>` : ''}
          ${p.looking_for_company ? `<div class="user-card-looking">🔍 Ищет компанию</div>` : ''}
        </div>
      </div>
      ${!isSelf ? `
      <div class="user-card-actions">
        ${p.username ? `
        <button class="btn-a user-card-btn-write" data-username="${p.username}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Написать
        </button>` : ''}
        <button class="btn-b user-card-btn-follow ${following ? 'following' : ''}"
                data-user-id="${userId}">
          ${following ? 'Отписаться' : isFriend ? '👥 Друзья' : 'Подписаться'}
        </button>
      </div>` : ''}`;

    panel.querySelector('#btn-user-card-close')?.addEventListener('click', () => {
      panel.classList.remove('open');
    });
    panel.querySelector('.user-card-btn-write')?.addEventListener('click', e => {
      const un = e.currentTarget.dataset.username;
      window.Telegram?.WebApp?.openTelegramLink?.(`https://t.me/${un}`)
        ?? window.open(`https://t.me/${un}`, '_blank');
    });
    panel.querySelector('.user-card-btn-follow')?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      const uid = btn.dataset.userId;
      const nowFollowing = await toggleFollow(uid);
      btn.textContent    = nowFollowing ? 'Отписаться' : 'Подписаться';
      btn.classList.toggle('following', nowFollowing);
    });

  } catch (err) {
    console.warn('[MEOW] _loadUserCard:', err.message);
    panel.classList.remove('open');
  }
}

// ── Helpers ───────────────────────────────────────────

function _syncGoingButtons(eventId) {
  const going = state.goingIds.has(eventId);
  document.querySelectorAll(`.btn-going[data-event-id="${eventId}"]`).forEach(btn => {
    btn.classList.toggle('active', going);
    btn.textContent = going ? '✅ Идёшь' : '✓ Пойду';
  });
}

function _pluralize(n, f1, f2, f5) {
  const v = Math.abs(n) % 100;
  const v1 = v % 10;
  if (v > 10 && v < 20) return f5;
  if (v1 === 1) return f1;
  if (v1 >= 2 && v1 <= 4) return f2;
  return f5;
}
