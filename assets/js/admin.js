// ─── Admin Panel — CRUD Events & Reports ───────────────
import { $, posterGrad, renderTags, ICONS, TG } from './helpers.js';
import { state } from './state.js';
import { supabase, callEdge } from './supabase.js';
import { isAdmin, isAuthed } from './auth.js';
import { showToast } from './toast.js';
import { loadAllEvents, normalizeDate, parseDate } from './data.js';

// ── Available event tags ──────────────────────────────
let EVENT_TAGS = [
  'Концерт', 'Выставка', 'Вечеринка', 'Фестиваль',
  'Лекция', 'Йога', 'Бесплатно', 'Спорт',
  'Кино', 'Мастер-класс', 'Танцы', 'Театр',
];

// ── Load custom tags from Supabase ────────────────────
async function _loadTags() {
  try {
    const { data, error } = await supabase.from('tags').select('name').order('name');
    if (!error && data?.length) {
      const extra = data.map(t => t.name).filter(n => !EVENT_TAGS.includes(n));
      EVENT_TAGS = [...EVENT_TAGS, ...extra];
    }
  } catch { /* ignore */ }
}

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

    // Tabs: active / inactive / reports / admins
    html += `<div class="admin-tabs">
      <button class="admin-tab active" data-tab="active">Активные (${events.filter(e => e.is_active).length})</button>
      <button class="admin-tab" data-tab="inactive">Неактивные (${events.filter(e => !e.is_active).length})</button>
      <button class="admin-tab" data-tab="reports">Отчёты</button>
      <button class="admin-tab" data-tab="admins">🔑 Админы</button>
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

    // Admins management section (hidden by default)
    html += `<div id="admin-admins-section" style="display:none">
      <p style="padding:12px 0;color:var(--c-t2);font-size:13px;">Загрузка…</p>
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
        body.querySelector('#admin-events-list').style.display = (tabName === 'reports' || tabName === 'admins') ? 'none' : '';
        body.querySelector('#admin-events-inactive').style.display = (tabName === 'inactive') ? '' : 'none';
        body.querySelector('#admin-reports-section').style.display = (tabName === 'reports') ? '' : 'none';
        body.querySelector('#admin-admins-section').style.display = (tabName === 'admins') ? '' : 'none';
        if (tabName === 'reports') _loadReports(body.querySelector('#admin-reports-section'));
        if (tabName === 'admins') _loadAdminsSection(body.querySelector('#admin-admins-section'));
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

  // Delete (soft-delete — ставим deleted_at, не удаляем строку)
  container.querySelectorAll('.btn-admin-sm.delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Удалить мероприятие? Оно перестанет отображаться у пользователей.\n\nЕсли исходный пост всё ещё есть в Telegram-канале, при следующей синхронизации событие НЕ восстановится (soft-delete).')) return;
      try {
        const { error } = await supabase
          .from('events')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;

        showToast('Удалено');
        await loadAllEvents();
        document.dispatchEvent(new CustomEvent('meow:events-changed'));
        _renderAdminList($('admin-panel'));
      } catch (err) {
        showToast('Ошибка: ' + (err.message || err));
      }
    });
  });
}

// ─── Autocomplete for Location field ────────────────────

let _locationAutocompleteTimer = null;

function _initLocationAutocomplete() {
  const input = document.getElementById('admin-f-location');
  const container = document.getElementById('admin-location-suggestions');
  if (!input || !container) return;

  input.addEventListener('input', () => {
    clearTimeout(_locationAutocompleteTimer);
    const val = input.value.trim();
    if (val.length < 2) {
      container.innerHTML = '';
      container.classList.remove('open');
      return;
    }
    _locationAutocompleteTimer = setTimeout(() => {
      _fetchLocationSuggestions(val, container, input);
    }, 250);
  });

  // Close on blur
  input.addEventListener('blur', () => {
    setTimeout(() => {
      container.classList.remove('open');
    }, 200);
  });

  // Prevent closing on container click
  container.addEventListener('mousedown', (e) => e.preventDefault());
}

function _fetchLocationSuggestions(query, container, input) {
  const q = query.toLowerCase().trim();

  // 1. Search places.json (places in state)
  const placeResults = (state.rawPlaces || []).filter(p => {
    const name = (p.name || '').toLowerCase();
    const addr = (p.address || '').toLowerCase();
    const kw = (p.keywords || []).join(' ').toLowerCase();
    return name.includes(q) || addr.includes(q) || kw.includes(q);
  });

  // 2. Search geocode_cache.json (load fresh from file)
  let cacheResults = [];
  try {
    // Try to match keys from a preloaded cache (we'll lazy-load it)
    if (window._geocodeCache) {
      cacheResults = Object.keys(window._geocodeCache)
        .filter(key => key.toLowerCase().includes(q))
        .map(key => ({
          _cacheKey: key,
          name: key,
          lat: window._geocodeCache[key]?.[0],
          lon: window._geocodeCache[key]?.[1],
        }));
    }
  } catch { /* ignore */ }

  const allResults = [
    ...placeResults.map(p => ({ type: 'place', data: p })),
    ...cacheResults.map(r => ({ type: 'cache', data: r })),
  ];

  if (!allResults.length) {
    container.innerHTML = '';
    container.classList.remove('open');
    return;
  }

  // Deduplicate by name
  const seen = new Set();
  const unique = [];
  for (const r of allResults) {
    const label = r.type === 'place' ? r.data.name : r.data.name;
    if (!seen.has(label.toLowerCase())) {
      seen.add(label.toLowerCase());
      unique.push(r);
    }
  }

  container.innerHTML = unique.slice(0, 10).map(r => {
    if (r.type === 'place') {
      const p = r.data;
      return `<div class="admin-sug-item" data-type="place" data-place-id="${p.id}">
        <div class="admin-sug-icon">📍</div>
        <div class="admin-sug-text">${_esc(p.name)}</div>
        <div class="admin-sug-sub">${_esc(p.address || '')}</div>
      </div>`;
    } else {
      const c = r.data;
      return `<div class="admin-sug-item" data-type="cache" data-lat="${c.lat}" data-lon="${c.lon}">
        <div class="admin-sug-icon">🗺️</div>
        <div class="admin-sug-text">${_esc(c.name)}</div>
      </div>`;
    }
  }).join('');
  container.classList.add('open');

  // Bind clicks
  container.querySelectorAll('.admin-sug-item').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      if (type === 'place') {
        const placeId = el.dataset.placeId;
        const place = state.rawPlaces.find(p => p.id === placeId);
        if (place) {
          document.getElementById('admin-f-location').value = place.name;
          document.getElementById('admin-f-address').value = place.address || '';
          const latField = document.getElementById('admin-f-lat');
          const lonField = document.getElementById('admin-f-lon');
          if (latField) latField.value = place.lat ?? '';
          if (lonField) lonField.value = place.lng ?? place.lon ?? '';
        }
      } else if (type === 'cache') {
        const locInput = document.getElementById('admin-f-location');
        const addrInput = document.getElementById('admin-f-address');
        const latField = document.getElementById('admin-f-lat');
        const lonField = document.getElementById('admin-f-lon');
        if (locInput) locInput.value = el.querySelector('.admin-sug-text')?.textContent || '';
        if (addrInput) addrInput.value = el.querySelector('.admin-sug-text')?.textContent || '';
        if (latField) latField.value = el.dataset.lat || '';
        if (lonField) lonField.value = el.dataset.lon || '';
      }
      container.classList.remove('open');
    });
  });
}

// ── Lazy-load geocode cache ─────────────────────────────

async function _ensureGeocodeCache() {
  if (window._geocodeCache) return;
  try {
    const resp = await fetch('geocode_cache.json?' + Date.now());
    window._geocodeCache = await resp.json();
  } catch { window._geocodeCache = {}; }
}

// ── Event Form (create / edit) ────────────────────────

async function _renderEventForm(modal, event) {
  const body = modal.querySelector('.admin-body');
  if (!body) return;

  // Preload tags from DB on first form open
  _loadTags();
  _ensureGeocodeCache();

  const isEdit = !!event;
  const title = event?.title || '';
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

  // Collect all dates for this event group
  let dateRows = [];
  if (isEdit && event?.multi_day_group_id) {
    // Load all dates of the group from Supabase
    try {
      const { data } = await supabase
        .from('events')
        .select('id, date, time')
        .eq('multi_day_group_id', event.multi_day_group_id)
        .order('date');
      if (data?.length) {
        dateRows = data.map(d => ({ date: d.date, time: d.time || '' }));
      }
    } catch { /* ignore */ }
  }

  // If no group dates found, use the event's own date
  if (!dateRows.length) {
    dateRows = [{ date: event?.date || fmt(new Date()), time: event?.time || '' }];
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
      <div class="admin-field">
        <label class="admin-label">Даты проведения *</label>
        <div id="admin-f-dates-list" class="admin-dates-list">
          ${dateRows.map((dr, i) => `
            <div class="admin-date-row">
              <input class="admin-input admin-date-input" value="${_esc(dr.date)}" placeholder="01.01.2026" required>
              <input class="admin-input admin-time-input" value="${_esc(dr.time)}" placeholder="19:00">
              ${i > 0 ? `<button type="button" class="btn-admin-remove-date" title="Удалить дату">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>` : ''}
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn-admin-add-date" id="btn-admin-add-date">➕ Добавить дату</button>
      </div>
      <div class="admin-field" style="position:relative">
        <label class="admin-label" for="admin-f-location">Место / Локация
          <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--c-t2)">(введите для подсказок)</span>
        </label>
        <input class="admin-input" id="admin-f-location" value="${_esc(location)}" placeholder="Барн, Каштановая аллея 1а" autocomplete="off">
        <div class="admin-location-suggestions" id="admin-location-suggestions"></div>
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
        <div class="admin-tag-add-row">
          <input class="admin-input admin-tag-input" id="admin-f-new-tag" placeholder="Новый тег..." autocomplete="off">
          <button type="button" class="admin-tag-add-btn" id="admin-f-tag-add">Добавить</button>
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
        <label class="admin-label">Изображение</label>
        <div class="admin-image-row">
          <input class="admin-input" id="admin-f-image" value="${_esc(imageUrl)}" placeholder="URL изображения (https://... или images/...)">
          <div class="admin-file-upload-wrap">
            <label class="admin-file-btn" for="admin-f-file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </label>
            <input type="file" id="admin-f-file" accept="image/png,image/jpeg,image/webp" style="display:none">
          </div>
        </div>
        <div id="admin-image-preview" class="admin-image-preview" style="display:none">
          <img id="admin-preview-img" alt="Preview">
          <button type="button" class="admin-preview-remove" id="admin-preview-remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
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

  // ── Custom tag input ──────────────────────────────────
  const tagInput = body.querySelector('#admin-f-new-tag');
  const tagAddBtn = body.querySelector('#admin-f-tag-add');

  function addCustomTag() {
    const val = tagInput?.value?.trim();
    if (!val) return;
    // Check if already present in EVENT_TAGS
    const existingTag = body.querySelector(`.admin-tag[data-tag="${_esc(val)}"]`);
    if (existingTag) {
      existingTag.classList.add('selected');
      tagInput.value = '';
      return;
    }
    // Add a new tag chip
    const container = body.querySelector('#admin-f-tags');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-tag selected';
    btn.dataset.tag = val;
    btn.textContent = val;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      btn.classList.toggle('selected');
    });
    container.appendChild(btn);
    tagInput.value = '';
    // Also save to EVENT_TAGS for future
    if (!EVENT_TAGS.includes(val)) {
      EVENT_TAGS.push(val);
      // Save tag to Supabase tags table (fire and forget)
      supabase.from('tags').upsert({ name: val }, { onConflict: 'name' }).catch(() => {});
    }
  }

  tagAddBtn?.addEventListener('click', addCustomTag);
  tagInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTag();
    }
  });

  // ── Add date row ──────────────────────────────────────
  const datesList = body.querySelector('#admin-f-dates-list');
  const addDateBtn = body.querySelector('#btn-admin-add-date');

  addDateBtn?.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'admin-date-row';
    row.innerHTML = `
      <input class="admin-input admin-date-input" placeholder="01.01.2026" required>
      <input class="admin-input admin-time-input" placeholder="19:00">
      <button type="button" class="btn-admin-remove-date" title="Удалить дату">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    row.querySelector('.btn-admin-remove-date')?.addEventListener('click', () => {
      row.remove();
    });
    datesList?.appendChild(row);
  });

  // Remove date buttons (for existing rows)
  datesList?.querySelectorAll('.btn-admin-remove-date').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.admin-date-row')?.remove();
    });
  });

  // ── Active toggle ─────────────────────────────────────
  body.querySelector('#admin-f-active')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
  });

  // ── Image upload ──────────────────────────────────────
  const fileInput = body.querySelector('#admin-f-file');
  const imageUrlInput = body.querySelector('#admin-f-image');
  const previewWrap = body.querySelector('#admin-image-preview');
  const previewImg = body.querySelector('#admin-preview-img');
  const previewRemove = body.querySelector('#admin-preview-remove');

  // Store base64 fallback data
  let _lastBase64 = '';

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview + get base64 as fallback
    const reader = new FileReader();
    reader.onload = (re) => {
      const dataUrl = re.target.result;
      _lastBase64 = dataUrl;
      if (previewImg && previewWrap) {
        previewImg.src = dataUrl;
        previewWrap.style.display = 'flex';
      }
      // Auto-fill the URL field with base64 as temporary fallback
      if (imageUrlInput) imageUrlInput.value = dataUrl;
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    try {
      const fileName = `events/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        if (imageUrlInput) imageUrlInput.value = urlData.publicUrl;
        _lastBase64 = '';
        showToast('✅ Изображение загружено');
      }
    } catch (err) {
      console.warn('[MEOW] Supabase Storage upload failed, keeping base64:', err.message);
      // The base64 data URL is already in the image field as fallback
      // Show specific error about the bucket
      if (err.message?.includes('bucket') || err.message?.includes('not found')) {
        showToast('⚠️ Бакет event-images не найден. Выполните миграцию SQL.');
      } else {
        showToast('⚠️ Изображение сохранено как base64 (будет в данных события)');
      }
    }
  });

  // Remove preview
  previewRemove?.addEventListener('click', () => {
    if (previewWrap) previewWrap.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
    if (imageUrlInput) imageUrlInput.value = '';
  });

  // Update preview when URL changes
  imageUrlInput?.addEventListener('input', () => {
    const url = imageUrlInput.value.trim();
    if (url && previewImg && previewWrap) {
      previewImg.src = url;
      previewWrap.style.display = 'flex';
    } else if (previewWrap) {
      previewWrap.style.display = 'none';
    }
  });

  // ── Cancel ────────────────────────────────────────────
  body.querySelector('#admin-f-cancel')?.addEventListener('click', () => {
    _renderAdminList(modal);
  });

  // ── Submit ────────────────────────────────────────────
  body.querySelector('#admin-event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await _submitEvent(modal, isEdit);
  });

  // ── Initialize location autocomplete ────────────────
  _initLocationAutocomplete();
}

function _generateEventId(dateStr, title) {
  // Stable ID like the Python backend: md5(date|title)[:12]
  const src = `${dateStr}|${title}`;
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    const chr = src.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  // Convert to hex string
  const h = (hash >>> 0).toString(16);
  return h.padStart(12, '0').slice(0, 12);
}

async function _submitEvent(modal, isEdit) {
  const body = modal.querySelector('.admin-body');
  if (!body) return;

  const title = body.querySelector('#admin-f-title')?.value?.trim();
  if (!title) {
    showToast('Название обязательно');
    return;
  }

  // Collect all date rows
  const dateRows = body.querySelectorAll('#admin-f-dates-list .admin-date-row');
  if (!dateRows.length) {
    showToast('Добавьте хотя бы одну дату');
    return;
  }

  // Validate dates
  const dates = [];
  for (const row of dateRows) {
    const d = row.querySelector('.admin-date-input')?.value?.trim();
    if (!d) {
      showToast('Заполните все даты');
      return;
    }
    const normalized = normalizeDate(d);
    if (!normalized) {
      showToast(`Некорректная дата: ${d}`);
      return;
    }
    dates.push({
      date: normalized,
      time: row.querySelector('.admin-time-input')?.value?.trim() || '',
    });
  }

  // Collect selected tags
  const tags = [];
  body.querySelectorAll('.admin-tag.selected').forEach(btn => tags.push(btn.dataset.tag));

  // Common fields shared by all dates
  const commonFields = {
    title,
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

  // Compute lat/lon if missing
  if (!commonFields.lat && commonFields.location) {
    try {
      const gcResp = await fetch(`geocode_cache.json`);
      const gcCache = await gcResp.json();
      const match = Object.entries(gcCache).find(([key]) =>
        key.toLowerCase().includes(commonFields.location.toLowerCase())
      );
      if (match) {
        commonFields.lat = match[1]?.[0] ?? null;
        commonFields.lon = match[1]?.[1] ?? null;
      }
    } catch { /* ignore */ }
  }

  try {
    if (isEdit) {
      // ── Editing ──────────────────────────────────────
      const existingId = body.querySelector('#admin-f-id')?.value;
      const existingEvent = state.rawAllEvents.find(e => e.id === existingId);
      const groupId = existingEvent?.multi_day_group_id || existingId; // use existing ID as group if no group yet

      // Get all current rows in this group from DB
      let groupRows = [];
      if (existingEvent?.multi_day_group_id) {
        const { data } = await supabase
          .from('events')
          .select('id, date')
          .eq('multi_day_group_id', existingEvent.multi_day_group_id);
        groupRows = data || [];
      } else {
        // Single event being edited — just this one row
        groupRows = [{ id: existingId }];
      }

      const existingDateSet = new Set(groupRows.map(r => r.date));

      // Update common fields for ALL existing rows in group
      for (const row of groupRows) {
        // Find matching new date
        const newDate = dates.find(d => d.date === row.date);
        if (newDate) {
          // Update existing row
          await supabase.from('events').update({
            ...commonFields,
            date: newDate.date,
            time: newDate.time,
            multi_day_group_id: groupId,
          }).eq('id', row.id);
        } else {
          // This date was removed — delete the row
          await supabase.from('events').delete().eq('id', row.id);
        }
      }

      // Add new dates that don't exist yet
      for (const d of dates) {
        if (!existingDateSet.has(d.date)) {
          const newId = _generateEventId(d.date, title);
          await supabase.from('events').insert({
            ...commonFields,
            id: newId,
            date: d.date,
            time: d.time,
            multi_day_group_id: groupId,
            created_by: existingEvent?.created_by || state.user?.id || null,
          });
        }
      }

    } else {
      // ── Creating ─────────────────────────────────────
      if (dates.length === 1) {
        // Single date — no group ID needed
        const eventId = _generateEventId(dates[0].date, title);
        const { error } = await supabase.from('events').insert({
          ...commonFields,
          id: eventId,
          date: dates[0].date,
          time: dates[0].time,
          created_by: state.user?.id || null,
        });
        if (error) throw error;
      } else {
        // Multiple dates — create with shared group ID
        const groupId = _generateId();
        for (const d of dates) {
          const eventId = _generateEventId(d.date, title);
          const { error } = await supabase.from('events').insert({
            ...commonFields,
            id: eventId,
            date: d.date,
            time: d.time,
            multi_day_group_id: groupId,
            created_by: state.user?.id || null,
          });
          if (error) throw error;
        }
      }
    }

    showToast(isEdit ? '✅ Сохранено' : '✅ Создано');
    await loadAllEvents();
    document.dispatchEvent(new CustomEvent('meow:events-changed'));
    _renderAdminList(modal);
  } catch (err) {
    console.error('[MEOW] Admin save error:', err);
    showToast('Ошибка: ' + (err.message || 'Неизвестная'));
  }
}

export async function openAdminEditPlace(placeId) {
  const modal = $('admin-panel');
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  history.pushState({ meowAdmin: true }, '');

  const place = state.rawPlaces?.find(p => p.id === placeId);
  if (place) {
    _renderPlaceForm(modal, place);
  } else {
    try {
      const { data } = await supabase.from('places').select('*').eq('id', placeId).single();
      if (data) _renderPlaceForm(modal, data);
      else {
        showToast('Место не найдено');
        closeAdminPanel();
      }
    } catch {
      showToast('Ошибка загрузки');
      closeAdminPanel();
    }
  }
}

function _renderPlaceForm(modal, place) {
  const body = modal.querySelector('.admin-body');
  if (!body) return;

  const isEdit = !!place;
  const name = place?.name || '';
  const address = place?.address || '';
  const description = place?.description || '';
  const time = place?.time || '';
  const lat = place?.lat ?? '';
  const lng = place?.lng ?? place?.lon ?? '';
  const imageUrl = place?.image_url || place?.imageUrl || '';
  const keywords = Array.isArray(place?.keywords) ? place.keywords.join(', ') : (place?.keywords || '');
  const isActive = place?.is_active !== undefined ? place.is_active : true;

  const header = modal.querySelector('.admin-header');
  if (header) {
    header.innerHTML = `
      <button class="admin-back" id="admin-panel-back-btn" aria-label="Назад">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="admin-header-title">${isEdit ? '✏️ Редактировать место' : '➕ Создать место'}</div>
    `;
    header.querySelector('#admin-panel-back-btn')?.addEventListener('click', () => {
      closeAdminPanel();
    });
  }

  const idField = isEdit ? `<input type="hidden" id="admin-pf-id" value="${_esc(place.id)}">` : '';

  body.innerHTML = `
    <form id="admin-place-form" class="admin-form">
      ${idField}
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-name">Название *</label>
        <input class="admin-input" id="admin-pf-name" value="${_esc(name)}" placeholder="Название места" required>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-address">Адрес</label>
        <input class="admin-input" id="admin-pf-address" value="${_esc(address)}" placeholder="Каштановая аллея 1а">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-time">Часы работы</label>
        <input class="admin-input" id="admin-pf-time" value="${_esc(time)}" placeholder="пн-чт 16:00-00:00...">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-desc">Описание</label>
        <textarea class="admin-textarea" id="admin-pf-desc" rows="3" placeholder="Краткое описание места…">${_esc(description)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-keywords">Ключевые слова (через запятую, для сопоставления с событиями)</label>
        <input class="admin-input" id="admin-pf-keywords" value="${_esc(keywords)}" placeholder="барн, barn">
      </div>
      <div class="admin-field">
        <label class="admin-label">Изображение</label>
        <div class="admin-image-row">
          <input class="admin-input" id="admin-pf-image" value="${_esc(imageUrl)}" placeholder="URL изображения">
          <div class="admin-file-upload-wrap">
            <label class="admin-file-btn" for="admin-pf-file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </label>
            <input type="file" id="admin-pf-file" accept="image/png,image/jpeg,image/webp" style="display:none">
          </div>
        </div>
        <div id="admin-pf-image-preview" class="admin-image-preview" style="display:none">
          <img id="admin-pf-preview-img" alt="Preview">
          <button type="button" class="admin-preview-remove" id="admin-pf-preview-remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="admin-row-2">
        <div class="admin-field">
          <label class="admin-label" for="admin-pf-lat">Широта (lat) *</label>
          <input class="admin-input" id="admin-pf-lat" type="number" step="any" value="${lat}" placeholder="54.710" required>
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-pf-lng">Долгота (lng) *</label>
          <input class="admin-input" id="admin-pf-lng" type="number" step="any" value="${lng}" placeholder="20.467" required>
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-toggle-row">
          <span class="admin-label" style="margin-bottom:0">Активно</span>
          <div class="toggle ${isActive ? 'active' : ''}" id="admin-pf-active"></div>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="btn-admin-cancel" id="admin-pf-cancel">Отмена</button>
        <button type="submit" class="btn-admin-save">
          ${isEdit ? '💾 Сохранить' : '➕ Создать'}
        </button>
      </div>
    </form>
  `;

  body.querySelector('#admin-pf-active')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
  });

  const fileInput = body.querySelector('#admin-pf-file');
  const imageUrlInput = body.querySelector('#admin-pf-image');
  const previewWrap = body.querySelector('#admin-pf-image-preview');
  const previewImg = body.querySelector('#admin-pf-preview-img');
  const previewRemove = body.querySelector('#admin-pf-preview-remove');

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (re) => {
      const dataUrl = re.target.result;
      if (previewImg && previewWrap) {
        previewImg.src = dataUrl;
        previewWrap.style.display = 'flex';
      }
      if (imageUrlInput) imageUrlInput.value = dataUrl;
    };
    reader.readAsDataURL(file);

    try {
      const fileName = `places/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage
        .from('event-images')
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('event-images').getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        if (imageUrlInput) imageUrlInput.value = urlData.publicUrl;
        showToast('✅ Изображение загружено');
      }
    } catch (err) {
      console.warn('[MEOW] Place image upload failed, keeping base64:', err.message);
      showToast('⚠️ Изображение сохранено как base64');
    }
  });

  previewRemove?.addEventListener('click', () => {
    if (previewWrap) previewWrap.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
    if (imageUrlInput) imageUrlInput.value = '';
  });

  imageUrlInput?.addEventListener('input', () => {
    const url = imageUrlInput.value.trim();
    if (url && previewImg && previewWrap) {
      previewImg.src = url;
      previewWrap.style.display = 'flex';
    } else if (previewWrap) {
      previewWrap.style.display = 'none';
    }
  });
  if (imageUrl && previewImg && previewWrap) {
    previewImg.src = imageUrl;
    previewWrap.style.display = 'flex';
  }

  body.querySelector('#admin-pf-cancel')?.addEventListener('click', () => {
    closeAdminPanel();
  });

  body.querySelector('#admin-place-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await _submitPlace(modal, isEdit);
  });
}

async function _submitPlace(modal, isEdit) {
  const body = modal.querySelector('.admin-body');
  if (!body) return;

  const name = body.querySelector('#admin-pf-name')?.value?.trim();
  const lat = parseFloat(body.querySelector('#admin-pf-lat')?.value);
  const lng = parseFloat(body.querySelector('#admin-pf-lng')?.value);
  if (!name || Number.isNaN(lat) || Number.isNaN(lng)) {
    showToast('Название, широта и долгота обязательны');
    return;
  }

  const keywordsRaw = body.querySelector('#admin-pf-keywords')?.value || '';
  const keywords = keywordsRaw.split(',').map(s => s.trim()).filter(Boolean);

  const payload = {
    name,
    address: body.querySelector('#admin-pf-address')?.value?.trim() || '',
    description: body.querySelector('#admin-pf-desc')?.value || '',
    time: body.querySelector('#admin-pf-time')?.value?.trim() || '',
    lat,
    lng,
    keywords,
    image_url: body.querySelector('#admin-pf-image')?.value?.trim() || null,
    is_active: body.querySelector('#admin-pf-active')?.classList.contains('active') ?? true,
  };

  if (!isEdit) payload.id = 'place-' + _generateId();
  const elId = body.querySelector('#admin-pf-id')?.value;
  const placeId = isEdit ? elId : payload.id;

  try {
    let result;
    if (isEdit) {
      result = await supabase.from('places').update(payload).eq('id', placeId);
    } else {
      result = await supabase.from('places').insert(payload);
    }
    if (result.error) throw result.error;

    showToast(isEdit ? '✅ Сохранено' : '✅ Создано');
    const { loadPlaces } = await import('./places.js');
    await loadPlaces();
    document.dispatchEvent(new CustomEvent('meow:places-changed'));
    closeAdminPanel();
  } catch (err) {
    console.error('[MEOW] Place save error:', err);
    showToast('Ошибка: ' + (err.message || 'Неизвестная'));
  }
}

// ── Admins Management Section ────────────────────────

async function _loadAdminsSection(container) {
  if (!container) return;
  container.innerHTML = '<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">Загрузка…</p>';

  try {
    // Load current admins with profiles via Edge Function (uses service_role — bypasses RLS)
    const result = await callEdge('manage-admin', { action: 'list' });

    const adminRoles = result.admins || [];
    const adminProfiles = result.profiles || [];
    const adminMap = {};
    adminRoles.forEach(a => { adminMap[a.user_id] = a; });

    // Count total users for the search
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    let html = '';

    // ── Current admins list ─────────────────────────
    html += `<div style="margin-bottom:12px">
      <div class="admin-label" style="margin-bottom:8px;font-size:12px">
        👑 Текущие админы (${adminProfiles.length})
      </div>`;

    if (!adminProfiles.length) {
      html += `<p class="admin-empty">Нет назначенных админов</p>`;
    } else {
      html += adminProfiles.map(p => {
        const role = adminMap[p.id]?.role || 'admin';
        const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
        const isSelf = p.id === state.user?.id;
        return `
          <div class="admin-event-row" data-uid="${p.id}">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--c-accent-d);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;color:var(--c-accent)">
              ${initials}
            </div>
            <div class="admin-event-info">
              <div class="admin-event-title">${_esc(p.first_name || '')} ${_esc(p.last_name || '')}</div>
              <div class="admin-event-date">@${_esc(p.username || '—')} · ${role === 'super_admin' ? '⭐ Супер-админ' : '🔑 Админ'}</div>
            </div>
            <div class="admin-event-badges">
              ${isSelf ? '<span class="admin-badge active" style="font-size:10px">Это вы</span>' : ''}
            </div>
            <div class="admin-event-actions">
              ${!isSelf
                ? `<button class="btn-admin-sm delete admin-remove-admin" data-uid="${p.id}" title="Убрать админа">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>`
                : ''
              }
            </div>
          </div>`;
      }).join('');
    }
    html += `</div>`;

    // ── Add new admin ───────────────────────────────
    html += `<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--c-soft-br)">
      <div class="admin-label" style="margin-bottom:8px;font-size:12px">
        🔍 Назначить админа
      </div>
      <div style="position:relative">
        <input class="admin-input" id="admin-user-search-input"
               placeholder="Введите имя, фамилию или @username..."
               autocomplete="off" style="margin-bottom:4px">
        <div id="admin-user-search-results" style="max-height:240px;overflow-y:auto"></div>
      </div>
      <p style="font-size:11px;color:var(--c-t2);margin-top:6px">
        Всего пользователей в сервисе: <strong>${totalUsers ?? '—'}</strong>
      </p>
    </div>`;

    container.innerHTML = html;

    // ── Bind remove buttons ──────────────────────────
    container.querySelectorAll('.admin-remove-admin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        if (!confirm('Убрать этого пользователя из админов?')) return;
        try {
          await callEdge('manage-admin', { action: 'remove', target_user_id: uid });
          showToast('✅ Админ удалён');
          _loadAdminsSection(container);
        } catch (err) {
          showToast('Ошибка: ' + (err.message || err));
        }
      });
    });

    // ── User search ─────────────────────────────────
    _initUserSearch(container);

  } catch (err) {
    console.error('[MEOW] Admins section error:', err);
    container.innerHTML = '<p style="padding:12px 0;text-align:center;color:var(--c-t2);font-size:13px;">Ошибка загрузки</p>';
  }
}

// ── Cached admin IDs (loaded from Edge Function to bypass RLS) ──
let _cachedAdminIds = new Set();

// ── User search for admin promotion ──────────────────

let _userSearchTimer = null;

function _initUserSearch(container) {
  // Ensure we have current admin IDs cached from the section load
  (async () => {
    try {
      const result = await callEdge('manage-admin', { action: 'list' });
      _cachedAdminIds = new Set((result.admins || []).map(a => a.user_id));
    } catch {}
  })();
  const input = container.querySelector('#admin-user-search-input');
  const results = container.querySelector('#admin-user-search-results');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    clearTimeout(_userSearchTimer);
    const val = input.value.trim();
    if (val.length < 2) {
      results.innerHTML = '';
      return;
    }
    _userSearchTimer = setTimeout(() => {
      _searchUsers(val, results, container);
    }, 300);
  });
}

async function _searchUsers(query, resultsEl, container) {
  const q = query.toLowerCase().trim();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username, photo_url')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(20);

    if (error) throw error;

    if (!data?.length) {
      resultsEl.innerHTML = '<p style="padding:8px 0;color:var(--c-t2);font-size:12px">Ничего не найдено</p>';
      return;
    }

    // Check which are already admins (using cached IDs from Edge Function)
    const adminIds = _cachedAdminIds;

    resultsEl.innerHTML = data.map(p => {
      const isAlreadyAdmin = adminIds.has(p.id);
      const initials = ((p.first_name?.[0] ?? '') + (p.last_name?.[0] ?? '')).toUpperCase() || '?';
      return `
        <div class="admin-event-row" data-uid="${p.id}" style="cursor:pointer;margin-bottom:4px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--c-accent-d);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;color:var(--c-accent)">
            ${initials}
          </div>
          <div class="admin-event-info">
            <div class="admin-event-title">${_esc(p.first_name || '')} ${_esc(p.last_name || '')}</div>
            <div class="admin-event-date">@${_esc(p.username || '—')}</div>
          </div>
          <div class="admin-event-badges">
            ${isAlreadyAdmin
              ? '<span class="admin-badge active">👑 Админ</span>'
              : ''
            }
          </div>
          <div class="admin-event-actions">
            ${!isAlreadyAdmin
              ? `<button class="btn-admin-sm edit admin-promote-btn" data-uid="${p.id}" title="Сделать админом" style="width:auto;padding:0 10px;font-size:11px;font-weight:700;color:var(--c-accent)">
                  + Назначить
                </button>`
              : ''
            }
          </div>
        </div>`;
    }).join('');

    // Bind promote buttons
    resultsEl.querySelectorAll('.admin-promote-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const uid = btn.dataset.uid;
        try {
          await callEdge('manage-admin', { action: 'add', target_user_id: uid });
          showToast('✅ Админ назначен');
          // Clear search
          const input = container.querySelector('#admin-user-search-input');
          if (input) input.value = '';
          resultsEl.innerHTML = '';
          // Reload admins section
          const adminsSection = container;
          _loadAdminsSection(adminsSection);
        } catch (err) {
          showToast('Ошибка: ' + (err.message || err));
        }
      });
    });

  } catch (err) {
    console.error('[MEOW] User search error:', err);
    resultsEl.innerHTML = '<p style="padding:8px 0;color:var(--c-t2);font-size:12px">Ошибка поиска</p>';
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