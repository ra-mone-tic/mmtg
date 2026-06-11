// ─── Admin Panel — CRUD Events & Reports ───────────────
import { $, posterGrad, renderTags, ICONS } from './helpers.js';
import { state } from './state.js';
import { supabase, rpc } from './supabase.js';
import { isAdmin, isAuthed } from './auth.js';
import { showToast } from './toast.js';
import { loadAllEvents, normalizeDate, parseDate } from './data.js';
import { TG } from './helpers.js';

// ── Available event tags ──────────────────────────────
const EVENT_TAGS = [
  'Концерт', 'Выставка', 'Вечеринка', 'Фестиваль',
  'Лекция', 'Йога', 'Бесплатно', 'Спорт',
  'Кино', 'Мастер-класс', 'Танцы', 'Театр',
];

// ── Open / Close ──────────────────────────────────────

export function openAdminPanel() {
  const modal = $('admin-panel');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  history.pushState({ meowAdmin: true }, '');
  _renderAdminList(modal);
}

export function closeAdminPanel() {
  const modal = $('admin-panel');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

export function openAdminCreate() {
  const modal = $('admin-panel');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  _renderEventForm(modal, null);
}

export async function openAdminEdit(eventId) {
  const modal = $('admin-panel');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  // Find event in state
  const ev = state.rawAllEvents.find(e => e.id === eventId);
  if (ev) {
    _renderEventForm(modal, ev);
  } else {
    // Try from Supabase
    try {
      const { data } = await supabase.from('events').select('*').eq('id', eventId).single();
      if (data) _renderEventForm(modal, data);
      else {
        showToast('Событие не найдено');
        closeAdminPanel();
      }
    } catch {
      showToast('Ошибка загрузки');
      closeAdminPanel();
    }
  }
}

// ── Events List (admin view) ──────────────────────────

async function _renderAdminList(modal) {
  const body = modal.querySelector('.admin-body');
  if (!body) return;
  body.innerHTML = '<p style="padding:20px;text-align:center;color:var(--c-t2)">Загрузка…</p>';

  try {
    let events = [];
    try {
      const { data, error } = await supabase.rpc('get_all_events_admin');
      if (error) throw error;
      events = data ?? [];
    } catch {
      // Fallback to state.rawAllEvents
      events = [...state.rawAllEvents].sort((a, b) => {
        const da = parseDate(a.date) || new Date(0);
        const db = parseDate(b.date) || new Date(0);
        return db - da;
      });
    }

    const header = modal.querySelector('.admin-header');
    if (header) {
      header.innerHTML = `
        <button class="admin-back" id="admin-panel-back-btn" aria-label="Назад">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="admin-header-title">🛡️ Админ-панель</div>
      `;
      header.querySelector('#admin-panel-back-btn')?.addEventListener('click', closeAdminPanel);
    }

    let html = '';

    // Create event button
    html += `<button class="btn-admin-create" id="btn-admin-create-event">
      ➕ Создать мероприятие
    </button>`;

    // Tabs: active / inactive / reports
    html += `<div class="admin-tabs">
      <button class="admin-tab active" data-tab="active">Активные (${events.filter(e => e.is_active).length})</button>
      <button class="admin-tab" data-tab="inactive">Неактивные (${events.filter(e => !e.is_active).length})</button>
      <button class="admin-tab" data-tab="reports">Отчёты</button>
    </div>`;

    // Events list
    html += `<div id="admin-events-list" class="admin-events-list">`;
    html += _renderEventsListHTML(events.filter(e => e.is_active), 'active');
    html += `<div id="admin-events-inactive" style="display:none">`;
    html += _renderEventsListHTML(events.filter(e => !e.is_active), 'inactive');
    html += `</div></div>`;

    // Reports section (hidden by default)
    html += `<div id="admin-reports-section" style="display:none">
      <p style="padding:12px 0;color:var(--c-t2);font-size:13px;">Загрузка отчётов…</p>
    </div>`;

    body.innerHTML = html;

    // Bind: create button
    body.querySelector('#btn-admin-create-event')?.addEventListener('click', () => {
      _renderEventForm(modal, null);
    });

    // Bind: tabs
    body.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        body.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        body.querySelector('#admin-events-list').style.display = (tabName === 'reports') ? 'none' : '';
        body.querySelector('#admin-events-inactive').style.display = (tabName === 'inactive') ? '' : 'none';
        body.querySelector('#admin-reports-section').style.display = (tabName === 'reports') ? '' : 'none';
        if (tabName === 'reports') _loadReports(body.querySelector('#admin-reports-section'));
      });
    });

    // Bind: edit/delete buttons
    _bindEventActions(body, events);

  } catch (err) {
    console.error('[MEOW] Admin list error:', err);
    body.innerHTML = '<p style="padding:20px;text-align:center;color:var(--c-t2)">Ошибка загрузки</p>';
  }
}

function _renderEventsListHTML(events, label) {
  if (!events.length) {
    return `<p class="admin-empty">Нет ${label === 'inactive' ? 'неактивных' : ''} событий</p>`;
  }
  return events.map(ev => {
    const active = ev.is_active;
    const dateStr = ev.date || '—';
    return `
      <div class="admin-event-row" data-event-id="${ev.id}">
        <div class="admin-event-info">
          <div class="admin-event-title">${_esc(ev.title)}</div>
          <div class="admin-event-date">${dateStr}${ev.time ? ' · ' + ev.time : ''}</div>
        </div>
        <div class="admin-event-badges">
          ${active
            ? '<span class="admin-badge active">✓ Активно</span>'
            : '<span class="admin-badge inactive">Неактивно</span>'}
        </div>
        <div class="admin-event-actions">
          <button class="btn-admin-sm edit" data-id="${ev.id}" title="Редактировать">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-admin-sm toggle-active" data-id="${ev.id}" data-active="${active}" title="${active ? 'Деактивировать' : 'Активировать'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${active
                ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}
            </svg>
          </button>
          <button class="btn-admin-sm delete" data-id="${ev.id}" title="Удалить">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function _bindEventActions(container) {
  // Edit
  container.querySelectorAll('.btn-admin-sm.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _renderEventForm($('admin-panel'), state.rawAllEvents.find(ev => ev.id === btn.dataset.id));
    });
  });

  // Toggle active
  container.querySelectorAll('.btn-admin-sm.toggle-active').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const currentlyActive = btn.dataset.active === 'true';
      try {
        const { error } = await supabase
          .from('events')
          .update({ is_active: !currentlyActive })
          .eq('id', id);
        if (error) throw error;
        showToast(currentlyActive ? 'Деактивировано' : 'Активировано');
        // Reload events
        await loadAllEvents();
        _renderAdminList($('admin-panel'));
      } catch (err) {
        showToast('Ошибка: ' + (err.message || err));
      }
    });
  });

  // Delete
  container.querySelectorAll('.btn-admin-sm.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Удалить событие? Это действие необратимо.')) return;
      try {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', id);
        if (error) throw error;
        showToast('Удалено');
        await loadAllEvents();
        _renderAdminList($('admin-panel'));
      } catch (err) {
        showToast('Ошибка: ' + (err.message || err));
      }
    });
  });
}

// ── Event Form (create / edit) ────────────────────────

function _renderEventForm(modal, event) {
  const body = modal.querySelector('.admin-body');
  if (!body) return;

  const isEdit = !!event;
  const title = event?.title || '';
  const date = event?.date || fmt(new Date());
  const time = event?.time || '';
  const location = event?.location || '';
  const address = event?.address || '';
  const tags = Array.isArray(event?.tags)
    ? event.tags
    : typeof event?.tags === 'string' ? event.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const shortDesc = event?.short_description || '';
  const fullDesc = event?.full_description || '';
  const contacts = event?.contacts || '';
  const lat = event?.lat ?? '';
  const lon = event?.lon ?? '';
  const imageUrl = event?.image_url || event?.imageUrl || '';
  const isActive = event?.is_active !== undefined ? event.is_active : true;

  const header = modal.querySelector('.admin-header');
  if (header) {
    header.innerHTML = `
      <button class="admin-back" id="admin-panel-back-btn" aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="admin-header-title">${isEdit ? '✏️ Редактировать' : '➕ Создать мероприятие'}</div>
    `;
    header.querySelector('#admin-panel-back-btn')?.addEventListener('click', () => {
      _renderAdminList(modal);
    });
  }

  // ID hidden field
  const idField = isEdit ? `<input type="hidden" id="admin-f-id" value="${_esc(event.id)}">` : '';

  body.innerHTML = `
    <form id="admin-event-form" class="admin-form">
      ${idField}
      <div class="admin-field">
        <label class="admin-label" for="admin-f-title">Название *</label>
        <input class="admin-input" id="admin-f-title" value="${_esc(title)}" placeholder="Название мероприятия" required>
      </div>
      <div class="admin-row-2">
        <div class="admin-field">
          <label class="admin-label" for="admin-f-date">Дата (ДД.ММ.ГГГГ) *</label>
          <input class="admin-input" id="admin-f-date" value="${_esc(date)}" placeholder="01.01.2026" required>
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-f-time">Время</label>
          <input class="admin-input" id="admin-f-time" value="${_esc(time)}" placeholder="19:00">
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-location">Место / Локация</label>
        <input class="admin-input" id="admin-f-location" value="${_esc(location)}" placeholder="Барн, Каштановая аллея 1а">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-address">Адрес</label>
        <input class="admin-input" id="admin-f-address" value="${_esc(address)}" placeholder="Каштановая аллея 1а, Калининград">
      </div>
      <div class="admin-field">
        <label class="admin-label">Теги</label>
        <div class="admin-tags" id="admin-f-tags">
          ${EVENT_TAGS.map(tag => {
            const selected = tags.includes(tag);
            return `<button type="button" class="admin-tag ${selected ? 'selected' : ''}" data-tag="${_esc(tag)}">${_esc(tag)}</button>`;
          }).join('')}
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-short-desc">Краткое описание</label>
        <textarea class="admin-textarea" id="admin-f-short-desc" rows="3" placeholder="Краткое описание…">${_esc(shortDesc)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-full-desc">Полное описание</label>
        <textarea class="admin-textarea" id="admin-f-full-desc" rows="6" placeholder="Полное описание…">${_esc(fullDesc)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-contacts">Контакты (URL или @username)</label>
        <input class="admin-input" id="admin-f-contacts" value="${_esc(contacts)}" placeholder="https://t.me/...">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-image">URL изображения</label>
        <input class="admin-input" id="admin-f-image" value="${_esc(imageUrl)}" placeholder="https://... или images/...">
      </div>
      <div class="admin-row-2">
        <div class="admin-field">
          <label class="admin-label" for="admin-f-lat">Широта (lat)</label>
          <input class="admin-input" id="admin-f-lat" type="number" step="any" value="${lat}" placeholder="54.710">
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-f-lon">Долгота (lon)</label>
          <input class="admin-input" id="admin-f-lon" type="number" step="any" value="${lon}" placeholder="20.467">
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-toggle-row">
          <span class="admin-label" style="margin-bottom:0">Активно</span>
          <div class="toggle ${isActive ? 'active' : ''}" id="admin-f-active"></div>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="btn-admin-cancel" id="admin-f-cancel">Отмена</button>
        <button type="submit" class="btn-admin-save">
          ${isEdit ? '💾 Сохранить' : '➕ Создать'}
        </button>
      </div>
    </form>
  `;

  // Tag toggle
  body.querySelectorAll('.admin-tag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.classList.toggle('selected');
    });
  });

  // Active toggle
  body.querySelector('#admin-f-active')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
  });

  // Cancel
  body.querySelector('#admin-f-cancel')?.addEventListener('click', () => {
    _renderAdminList(modal);
  });

  // Submit
  body.querySelector('#admin-event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await _submitEvent(modal, isEdit);
  });
}

async function _submitEvent(modal, isEdit) {
  const body = modal.querySelector('.admin-body');
  if (!body) return;

  const title = body.querySelector('#admin-f-title')?.value?.trim();
  const date = body.querySelector('#admin-f-date')?.value?.trim();
  if (!title || !date) {
    showToast('Название и дата обязательны');
    return;
  }

  // Collect selected tags
  const tags = [];
  body.querySelectorAll('.admin-tag.selected').forEach(btn => tags.push(btn.dataset.tag));

  const payload = {
    title,
    date: normalizeDate(date),
    time: body.querySelector('#admin-f-time')?.value?.trim() || '',
    location: body.querySelector('#admin-f-location')?.value?.trim() || '',
    address: body.querySelector('#admin-f-address')?.value?.trim() || '',
    tags,
    short_description: body.querySelector('#admin-f-short-desc')?.value || '',
    full_description: body.querySelector('#admin-f-full-desc')?.value || '',
    contacts: body.querySelector('#admin-f-contacts')?.value?.trim() || '',
    image_url: body.querySelector('#admin-f-image')?.value?.trim() || null,
    lat: body.querySelector('#admin-f-lat')?.value ? parseFloat(body.querySelector('#admin-f-lat').value) : null,
    lon: body.querySelector('#admin-f-lon')?.value ? parseFloat(body.querySelector('#admin-f-lon').value) : null,
    is_active: body.querySelector('#admin-f-active')?.classList.contains('active') ?? true,
  };

  // If creating new event, generate a short random ID
  if (!isEdit) {
    payload.id = _generateId();
    payload.created_by = state.user?.id || null;
    // Compute lat/lon from address if missing and location is set
    if (!payload.lat && payload.location) {
      // Use geocode cache if available
      try {
        const gcResp = await fetch(`geocode_cache.json`);
        const gcCache = await gcResp.json();
        // Simple check if location matches any cached place
        const match = gcCache.find(c => c.query?.toLowerCase().includes(payload.location.toLowerCase()));
        if (match) {
          payload.lat = match.lat;
          payload.lon = match.lon;
        }
      } catch { /* ignore */ }
    }
  }

  const elId = body.querySelector('#admin-f-id')?.value;
  const eventId = isEdit ? elId : payload.id;

  try {
    let result;
    if (isEdit) {
      result = await supabase.from('events').update(payload).eq('id', eventId);
    } else {
      result = await supabase.from('events').insert(payload);
    }
    if (result.error) throw result.error;

    showToast(isEdit ? '✅ Сохранено' : '✅ Создано');
    await loadAllEvents();
    _renderAdminList(modal);
  } catch (err) {
    console.error('[MEOW] Admin save error:', err);
    showToast('Ошибка: ' + (err.message || 'Неизвестная'));
  }
}

// ── Reports Section ───────────────────────────────────

async function _loadReports(container) {
  if (!container) return;
  container.innerHTML = '<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">Загрузка отчётов…</p>';

  try {
    const { data, error } = await supabase.rpc('get_reports_admin');
    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = '<p class="admin-empty">Нет отчётов</p>';
      return;
    }

    container.innerHTML = data.map(r => {
      const badge = { new: '🆕', reviewed: '👁️', resolved: '✅' }[r.status] || '';
      const type = { bug: '🐛 Баг', wrong_info: '📝 Неверная инфо', spam: '🚫 Спам', other: '❓ Другое' }[r.type] || r.type;
      const targetLabel = r.target_type ? `${r.target_type}: ${r.target_id || '—'}` : '';

      return `
        <div class="admin-report-row" data-report-id="${r.id}">
          <div class="admin-report-head">
            <span class="admin-report-type">${type}</span>
            <span class="admin-report-status" data-status="${r.status}">${badge} ${r.status}</span>
          </div>
          <div class="admin-report-text">${_esc(r.text)}</div>
          <div class="admin-report-meta">
            <span>${_esc(r.reporter_name || 'Anonymous')}</span>
            <span>${_formatDate(r.created_at)}</span>
            ${targetLabel ? `<span>${_esc(targetLabel)}</span>` : ''}
          </div>
          <div class="admin-report-actions">
            ${r.status !== 'reviewed'
              ? `<button class="btn-admin-sm review" data-id="${r.id}">👁️ Рассмотрено</button>`
              : ''}
            ${r.status !== 'resolved'
              ? `<button class="btn-admin-sm resolve" data-id="${r.id}">✅ Решено</button>`
              : ''}
          </div>
        </div>`;
    }).join('');

    // Bind report actions
    container.querySelectorAll('.btn-admin-sm.review').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await supabase.rpc('update_report_status', { p_report_id: btn.dataset.id, p_status: 'reviewed' });
          showToast('Отмечено как рассмотрено');
          _loadReports(container);
        } catch { showToast('Ошибка'); }
      });
    });
    container.querySelectorAll('.btn-admin-sm.resolve').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await supabase.rpc('update_report_status', { p_report_id: btn.dataset.id, p_status: 'resolved' });
          showToast('Отмечено как решено');
          _loadReports(container);
        } catch { showToast('Ошибка'); }
      });
    });

  } catch (err) {
    console.error('[MEOW] Reports load error:', err);
    container.innerHTML = '<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">Ошибка загрузки отчётов</p>';
  }
}

// ── Helpers ───────────────────────────────────────────

const _ESC = { '&': 'amp;', '<': 'lt;', '>': 'gt;', '"': 'quot;', "'": '#39;' };
function _esc(s) { return String(s || '').replace(/[&<>"']/g, ch => _ESC[ch]); }

function _generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fmt(d) {
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}