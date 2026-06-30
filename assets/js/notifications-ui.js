// ─── Notifications — bell, badge, panel, realtime ─────
import { $, TG } from './helpers.js';
import { state } from './state.js';
import { supabase, subscribeTable } from './supabase.js';
import { isAuthed } from './auth.js';

let _panelOpen = false;
let _realtimeChannel = null;

// ── Init ───────────────────────────────────────────────

export async function initNotifications() {
  if (!isAuthed()) return;
  await loadUnreadCount();
  bindBell();
  subscribeRealtime();
}

// ── Load unread count ──────────────────────────────────

export async function loadUnreadCount() {
  if (!isAuthed()) { state.unreadNotifCount = 0; _syncBadge(); return; }
  try {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', state.user.id)
      .eq('read', false);
    state.unreadNotifCount = count ?? 0;
  } catch (_) { state.unreadNotifCount = 0; }
  _syncBadge();
}

// ── Bell button ────────────────────────────────────────

function bindBell() {
  const bell = $('btn-notifications');
  if (!bell) return;
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    _panelOpen = !_panelOpen;
    const panel = $('notif-panel');
    if (panel) {
      panel.classList.toggle('open', _panelOpen);
      if (_panelOpen) _renderPanel(panel);
    }
  });
}

// ── Render panel ───────────────────────────────────────

async function _renderPanel(panel) {
  const list = panel.querySelector('.notif-list');
  if (!list) return;
  list.innerHTML = '<div class="notif-empty">Загрузка…</div>';

  try {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!data?.length) {
      list.innerHTML = '<div class="notif-empty">Нет уведомлений</div>';
      return;
    }

    list.innerHTML = data.map(n => `
      <div class="notif-item${n.read ? '' : ' unread'}" data-notif-id="${n.id}">
        <div class="notif-icon">${_iconForType(n.type)}</div>
        <div class="notif-content">
          <div class="notif-title">${_esc(n.title || '')}</div>
          <div class="notif-body">${_esc(n.body || '')}</div>
          <div class="notif-time">${_timeAgo(n.created_at)}</div>
        </div>
      </div>
    `).join('');

    // Mark as read on click
    list.querySelectorAll('.notif-item.unread').forEach(item => {
      item.addEventListener('click', async () => {
        const nid = item.dataset.notifId;
        item.classList.remove('unread');
        await supabase.from('notifications').update({ read: true }).eq('id', nid);
        state.unreadNotifCount = Math.max(0, state.unreadNotifCount - 1);
        _syncBadge();
      });
    });

  } catch (err) {
    console.warn('[MEOW] notifications render:', err.message);
    list.innerHTML = '<div class="notif-empty">Ошибка загрузки</div>';
  }
}

// ── Realtime subscription ──────────────────────────────

function subscribeRealtime() {
  if (_realtimeChannel) return;
  if (!state.user?.id) return;

  _realtimeChannel = subscribeTable(
    'notifications',
    `user_id=eq.${state.user.id}`,
    (payload) => {
      if (payload.eventType === 'INSERT') {
        state.unreadNotifCount++;
        _syncBadge();
        // Show toast for important notifications
        const n = payload.new;
        if (n && ['friend_going', 'new_follower', 'looking'].includes(n.type)) {
          // Lazy import to avoid circular deps
          import('./toast.js').then(({ showToast }) => {
            showToast(`${_iconForType(n.type)} ${n.title || n.body || 'Новое уведомление'}`);
          });
        }
      }
    }
  );
}

export function destroyRealtime() {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}

// ── Close panel on outside click ───────────────────────

export function handleOutsideClick(e) {
  if (!_panelOpen) return;
  const panel = $('notif-panel');
  const bell  = $('btn-notifications');
  if (panel && !panel.contains(e.target) && bell && !bell.contains(e.target)) {
    _panelOpen = false;
    panel.classList.remove('open');
  }
}

// ── Helpers ────────────────────────────────────────────

function _syncBadge() {
  const badge = $('notif-badge');
  if (!badge) return;
  badge.textContent = state.unreadNotifCount > 99 ? '99+' : String(state.unreadNotifCount);
  badge.dataset.count = String(state.unreadNotifCount);
}

function _iconForType(type) {
  const icons = {
    favorite_event: '❤️',
    friend_going:   '🎉',
    new_follower:   '👤',
    friend_request: '🤝',
    event_reminder: '⏰',
    looking:        '🔍',
    system:         '📢',
  };
  return icons[type] ?? '🔔';
}

const _ESC = { '&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;' };
function _esc(s) { return String(s || '').replace(/[&<>"']/g, ch => _ESC[ch]); }

function _timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ч назад`;
  const days = Math.floor(hrs / 24);
  return `${days} д назад`;
}