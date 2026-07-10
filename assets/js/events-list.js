// ─── Events List & Panel ─────────────────────────────
import { $, dayName, fmt } from './helpers.js';
import { state } from './state.js';
import { filterByDate, parseDate } from './data.js';
import { flyTo } from './map-core.js';

let _onOpenCard   = null;
let _onDateChange = null;
let _onOpenPlaceCard = null;

export function initEventsList({ onOpenCard, onDateChange, onOpenPlaceCard }) {
  _onOpenCard       = onOpenCard;
  _onDateChange     = onDateChange;
  _onOpenPlaceCard  = onOpenPlaceCard;
}

// ── Список ───────────────────────────────────────────

export function renderList(eventList) {
  // Если панель в режиме мест, не перерисовываем события
  if (state.panelMode === 'places') return;
  const list = $('events-list');
  if (!list) return;
  list.innerHTML = '';

  const evs = eventList ?? state.events;
  if (!evs.length) {
    list.innerHTML = '<p style="padding:16px;text-align:center;font-size:13px;color:var(--c-t2)">Событий нет</p>';
    return;
  }

  const groups = evs.reduce((acc, e) => { (acc[e.date] ??= []).push(e); return acc; }, {});
  for (const [date, items] of Object.entries(groups)) {
    const lbl = document.createElement('div');
    lbl.className   = 'day-label';
    lbl.textContent = dayName(date).toUpperCase();
    list.appendChild(lbl);

    items.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'event-item' + (ev.id === state.activeId ? ' active' : '');
      item.setAttribute('role',     'listitem');
      item.setAttribute('data-id',  ev.id);
      item.setAttribute('tabindex', '0');

      const tagStr = ev.tags?.length
        ? ' · ' + (Array.isArray(ev.tags) ? ev.tags : String(ev.tags).split(','))
            .map(s => s.trim()).filter(Boolean).slice(0, 2).join(', ')
        : '';
      // Показываем время сегодняшнего события
      const timeStr = ev.time ? ` · ${ev.time}` : '';
      item.innerHTML =
        `<div class="event-item-title">${ev.title}</div>
         <div class="event-item-sub">${ev.venue}${timeStr}${tagStr}</div>`;

      const go = async () => {
        if (ev.date !== fmt(state.currentDate)) await _onDateChange?.(ev.date);
        flyTo(ev);
        _onOpenCard?.(ev.id);
        setPanel(false);
      };
      item.addEventListener('click', go);
      item.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      list.appendChild(item);
    });
  }
}

// ── Синхронизация активного пункта ───────────────────

export function syncActive(id) {
  document.querySelectorAll('.event-item').forEach(el =>
    el.classList.toggle('active', el.getAttribute('data-id') === id)
  );
}

// ── Панель ───────────────────────────────────────────

export function setPanel(open, mode) {
  if (mode) state.panelMode = mode;
  state.panelOpen = open;

  const panel      = $('events-panel');
  const btnEvents  = $('btn-events');
  const btnPlaces  = $('btn-places');
  const panelHead  = panel?.querySelector('.panel-head');
  const eventsList = $('events-list');

  if (panel) {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
  }

  const isEvents = state.panelMode === 'events';

  // Toggle button active states
  if (btnEvents) {
    btnEvents.classList.toggle('active', open && isEvents);
    btnEvents.setAttribute('aria-expanded', String(open && isEvents));
  }
  if (btnPlaces) {
    btnPlaces.classList.toggle('active', open && !isEvents);
    btnPlaces.setAttribute('aria-expanded', String(open && !isEvents));
  }

  // Render content
  if (open) {
    if (isEvents) {
      applyPanelFilter('all');
    } else {
      renderPlacesList();
    }
  }
}

// ── Фильтры панели ───────────────────────────────────

export function applyPanelFilter(mode) {
  if (mode === 'today') {
    renderList(filterByDate(fmt(new Date())));
    return;
  }
  // Режим 'all' — все предстоящие события
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = [...new Set(state.rawAllEvents.map(e => e.date))]
    .filter(d => parseDate(d) !== null)
    .sort((a, b) => parseDate(a) - parseDate(b))
    .filter(d => parseDate(d) >= today);

  let result = [];
  upcoming.forEach(d => { result = result.concat(filterByDate(d)); });
  renderList(result);
}

// ── Places list ────────────────────────────────────

export function renderPlacesList() {
  const list = $('events-list');
  if (!list) return;
  list.innerHTML = '';

  const places = state.rawPlaces;
  if (!places.length) {
    list.innerHTML = '<p style="padding:16px;text-align:center;font-size:13px;color:var(--c-t2)">Мест нет</p>';
    return;
  }

  places.forEach(p => {
    const item = document.createElement('div');
    item.className = 'place-item' + (p.id === state.activePlaceId ? ' active' : '');
    item.setAttribute('role',     'listitem');
    item.setAttribute('data-place-id', p.id);
    item.setAttribute('tabindex', '0');

    item.innerHTML =
      `<div class="place-item-title">${p.name}</div>
       <div class="place-item-sub">${p.address || ''}</div>`;

    const go = () => {
      _onOpenPlaceCard?.(p.id);
      setPanel(false);
    };
    item.addEventListener('click', go);
    item.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    list.appendChild(item);
  });
}
