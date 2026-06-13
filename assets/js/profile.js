// ─── Profile — full-screen profile modal ──────────────
import { $, TG, posterGrad } from './helpers.js';
import { state } from './state.js';
import { supabase, subscribeTable } from './supabase.js';
import { isAuthed, isAdmin } from './auth.js';
import { loadFavoritesList } from './favorites.js';
import { loadFriends } from './social.js';
import { showToast } from './toast.js';

// ── Open / Close ───────────────────────────────────────

export function openProfile(userId) {
  const modal = $('profile-modal');
  if (!modal) return;
  modal.dataset.userId = userId ?? state.user?.id;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  TG()?.HapticFeedback?.impactOccurred('light');
  history.pushState({ meowProfile: true }, '');
  _renderProfile(modal);
}

export function closeProfile() {
  const modal = $('profile-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

// ── Render ─────────────────────────────────────────────

async function _renderProfile(modal) {
  const uid = modal.dataset.userId;
  if (!uid) return;

  const body = modal.querySelector('.profile-body');
  if (!body) return;
  body.innerHTML = '<p style="padding:20px;text-align:center;color:var(--c-t2)">Загрузка…</p>';

  try {
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', uid).single();
    if (!profile) { body.innerHTML = '<p style="padding:20px;text-align:center;color:var(--c-t2)">Профиль не найден</p>'; return; }

    const { data: levelData } = await supabase
      .from('user_levels').select('*').eq('level', profile.level).single();

    const isSelf = state.user?.id === uid;
    // For self: use cached is_admin from auth. For others: skip (avoids RLS recursion).
    const isUserAdmin = isSelf ? !!state.user?.is_admin : false;

    const stats = await _loadStats(uid);
    const friends = await loadFriends(uid);
    const favList = isSelf ? await loadFavoritesList() : [];

    const initials = ((profile.first_name?.[0] ?? '') + (profile.last_name?.[0] ?? '')).toUpperCase() || '?';
    const avatarHtml = profile.photo_url
      ? `<img src="${profile.photo_url}" alt="${profile.first_name}">`
      : `<span>${initials}</span>`;

    const levelBadge = isUserAdmin
      ? '🛡️ Админ'
      : (levelData ? `${levelData.badge_emoji} ${levelData.badge_label}` : '🌱 Новичок');

    // Header
    const header = modal.querySelector('.profile-header');
    if (header) {
      header.innerHTML = `
        <button class="profile-back" id="profile-back-btn" aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="profile-avatar">${avatarHtml}</div>
        <div class="profile-name">${profile.first_name ?? ''}${profile.last_name ? ' ' + profile.last_name : ''}</div>
        ${profile.username ? `<div class="profile-username">@${profile.username}</div>` : ''}
        <div class="profile-level">${levelBadge}</div>
      `;
      header.querySelector('#profile-back-btn')?.addEventListener('click', closeProfile);
    }

    // Body
    let html = '';

    // Bio
    html += `<div class="profile-bio-section">
      <div class="profile-bio-label">О себе</div>
      ${isSelf ? `
        <textarea class="profile-bio-input" id="profile-bio-input" maxlength="300"
                  placeholder="Расскажи о себе…">${_esc(profile.bio || '')}</textarea>
        <button class="profile-bio-save" id="profile-bio-save">Сохранить</button>
      ` : `
        <div class="profile-bio-text">${_esc(profile.bio || 'Пока ничего о себе не рассказал(а)')}</div>
      `}
    </div>`;

    // Stats
    html += `<div class="profile-stats">
      <div class="profile-stat">
        <div class="profile-stat-value">${stats.favorites}</div>
        <div class="profile-stat-label">Избранное</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${stats.going}</div>
        <div class="profile-stat-label">Пойду</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${stats.friends}</div>
        <div class="profile-stat-label">Друзья</div>
      </div>
    </div>`;

    // Settings (self only)
    if (isSelf) {
      html += `<div class="profile-settings">
        <div class="profile-settings-title">Настройки видимости</div>
        <div class="profile-setting-row">
          <div>
            <div class="profile-setting-text">Показывать «Пойду»</div>
            <div class="profile-setting-desc">Другие увидят, куда ты идёшь</div>
          </div>
          <div class="toggle ${profile.show_going ? 'active' : ''}" data-setting="show_going"></div>
        </div>
        <div class="profile-setting-row">
          <div>
            <div class="profile-setting-text">Показывать подписки</div>
            <div class="profile-setting-desc">Другие увидят, на кого ты подписан</div>
          </div>
          <div class="toggle ${profile.show_follow ? 'active' : ''}" data-setting="show_follow"></div>
        </div>
      </div>`;
    }

    // Friends
    if (friends.length) {
      html += `<div class="profile-friends-section">
        <div class="profile-friends-title">Друзья (${friends.length})</div>
        <div class="profile-friends-list">
          ${friends.map(f => {
            const fi = ((f.first_name?.[0] ?? '') + (f.last_name?.[0] ?? '')).toUpperCase() || '?';
            const av = f.photo_url
              ? `<img src="${f.photo_url}" alt="${f.first_name}">`
              : `<span>${fi}</span>`;
            return `<div class="profile-friend-row" data-uid="${f.id}">
              <div class="profile-friend-avatar">${av}</div>
              <div>
                <div class="profile-friend-name">${f.first_name ?? ''}${f.last_name ? ' ' + f.last_name : ''}</div>
                <div class="profile-friend-level">${f.level ?? 'newbie'}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    // Favorites (self only, inline)
    if (isSelf && favList.length) {
      html += `<div class="profile-fav-section">
        <div class="profile-fav-title">Избранное (${favList.length})</div>
        <div class="profile-fav-list">
          ${favList.map(ev => `
            <div class="profile-fav-item" data-event-id="${ev.id}">
              <div class="profile-fav-dot"></div>
              <div class="profile-fav-info">
                <div class="profile-fav-name">${_esc(ev.title)}</div>
                <div class="profile-fav-date">${ev.date ?? ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
    } else if (isSelf) {
      html += `<div class="profile-fav-section">
        <div class="profile-fav-title">Избранное</div>
        <div class="profile-fav-empty">Пока ничего не добавлено</div>
      </div>`;
    }

    // Admin section (self only, if admin)
    if (isSelf && isAdmin()) {
      html += `<div class="profile-admin-section">
        <div class="profile-admin-title">🛡️ Управление</div>
        <button class="btn-admin-create" id="profile-btn-admin-create" style="margin-top:10px">
          ➕ Создать мероприятие
        </button>
        <button class="btn-admin-panel" id="profile-btn-admin-panel" style="margin-top:8px;width:100%;height:44px;border-radius:var(--r-b);background:var(--c-glass);border:1.5px solid var(--c-glass-br);color:var(--c-accent);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px">
          🛡️ Админ-панель
        </button>
      </div>`;
    }

    body.innerHTML = html;

    // ── Bind events ────────────────────────────────────
    // Bio save
    body.querySelector('#profile-bio-save')?.addEventListener('click', async () => {
      const input = body.querySelector('#profile-bio-input');
      if (!input) return;
      const val = input.value.trim();
      try {
        await supabase.from('profiles').update({ bio: val }).eq('id', uid);
        state.user.bio = val;
        showToast('✅ Сохранено');
      } catch { showToast('Ошибка'); }
    });

    // Toggle settings
    body.querySelectorAll('.toggle[data-setting]').forEach(toggle => {
      toggle.addEventListener('click', async () => {
        const key = toggle.dataset.setting;
        const newVal = !toggle.classList.contains('active');
        toggle.classList.toggle('active', newVal);
        try {
          await supabase.from('profiles').update({ [key]: newVal }).eq('id', uid);
          if (state.user) state.user[key] = newVal;
        } catch { showToast('Ошибка'); }
      });
    });

    // Friend click → open their profile
    body.querySelectorAll('.profile-friend-row[data-uid]').forEach(row => {
      row.addEventListener('click', () => {
        openProfile(row.dataset.uid);
      });
    });

    // Admin buttons (dynamic import to avoid circular deps)
    body.querySelector('#profile-btn-admin-create')?.addEventListener('click', async () => {
      closeProfile();
      const mod = await import('./admin.js');
      mod.openAdminCreate();
    });
    body.querySelector('#profile-btn-admin-panel')?.addEventListener('click', async () => {
      closeProfile();
      const mod = await import('./admin.js');
      mod.openAdminPanel();
    });

    // Favorite item click → open event detail
    body.querySelectorAll('.profile-fav-item[data-event-id]').forEach(item => {
      item.addEventListener('click', () => {
        const evId = item.dataset.eventId;
        const ev = state.rawAllEvents.find(e => e.id === evId);
        if (ev) {
          closeProfile();
          // Dispatch custom event so meow-core can handle it
          document.dispatchEvent(new CustomEvent('meow:open-event', { detail: { eventId: evId } }));
        }
      });
    });

  } catch (err) {
    console.error('[MEOW] profile render error:', err);
    body.innerHTML = '<p style="padding:20px;text-align:center;color:var(--c-t2)">Ошибка загрузки</p>';
  }
}

// ── Stats ──────────────────────────────────────────────

async function _loadStats(userId) {
  const stats = { favorites: 0, going: 0, friends: 0 };
  try {
    const [fav, att, fr] = await Promise.all([
      supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('event_attendance').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('friends').select('user_a, user_b')
        .or(`user_a.eq.${userId},user_b.eq.${userId}`),
    ]);
    stats.favorites = fav.count ?? 0;
    stats.going = att.count ?? 0;
    stats.friends = fr.data?.length ?? 0;
  } catch (_) {}
  return stats;
}

// ── Helpers ────────────────────────────────────────────

const _ESC = { '&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;' };
function _esc(s) { return String(s || '').replace(/[&<>"']/g, ch => _ESC[ch]); }