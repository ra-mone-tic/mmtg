// ─── Search & Suggestions with Tag Chips ─────────────
import { $, fmt } from './helpers.js';
import { state } from './state.js';
import { normalizeEvent } from './data.js';
import { flyTo, flyToPlace } from './map-core.js';
import { searchPlaces, getPlaceById } from './places.js';
import { closeCard, openCard } from './card.js';
import { closePlaceCard, openPlaceCard } from './place-card.js';

let _onOpenCard   = null;
let _onDateChange = null;

export function initSearch({ onOpenCard, onDateChange }) {
  _onOpenCard   = onOpenCard;
  _onDateChange = onDateChange;
}

// ─── Chip management ─────────────────────────────────

/**
 * Добавляет тег как чипс в строку поиска.
 * Если такой тег уже есть — не дублирует.
 * После добавления — фокусирует поиск и показывает подсказки.
 */
export function addChip(tag) {
  if (!tag || state.searchChips.includes(tag)) return;
  state.searchChips.push(tag);
  _renderChips();
  // Фокус на поиск
  const inp = $('search-input');
  if (inp) {
    inp.focus();
    inp.value = '';
  }
  // Запускаем поиск с пустым вводом — покажем события по тегу
  handleSearch('');
}

/**
 * Удаляет чипс по индексу.
 */
export function removeChip(index) {
  state.searchChips.splice(index, 1);
  _renderChips();
  // Если чипсов больше нет — скрываем подсказки
  if (!state.searchChips.length) {
    hideSuggestions();
    const inp = $('search-input');
    if (inp) inp.value = '';
  } else {
    // Перезапускаем поиск
    const inp = $('search-input');
    handleSearch(inp?.value?.trim() || '');
  }
}

/**
 * Очищает все чипсы.
 */
export function clearChips() {
  state.searchChips = [];
  _renderChips();
  hideSuggestions();
  const inp = $('search-input');
  if (inp) inp.value = '';
}

function _renderChips() {
  const container = $('search-chips');
  const searchWrap = container?.closest('.search-wrap');
  const input = $('search-input');
  if (!container) return;
  if (!state.searchChips.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    searchWrap?.classList.remove('has-chips');
    if (input) input.style.paddingLeft = '';
    return;
  }
  container.style.display = 'flex';
  searchWrap?.classList.add('has-chips');

  container.innerHTML = state.searchChips.map((tag, idx) => `
    <span class="search-chip" data-index="${idx}">
      <span class="search-chip-label">${tag}</span>
      <button class="search-chip-remove" data-index="${idx}" aria-label="Убрать тег">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </span>
  `).join('');

  // Обработчики удаления
  container.querySelectorAll('.search-chip-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      removeChip(idx);
    });
  });

  // Сдвигаем input вправо на ширину чипсов (с запасом 12px)
  requestAnimationFrame(() => {
    if (!state.searchChips.length) return;
    const chipsWidth = container.scrollWidth;
    if (input && chipsWidth > 0) {
      input.style.paddingLeft = (chipsWidth + 16) + 'px';
    }
  });
}

// ─── Search ───────────────────────────────────────────

export function handleSearch(q) {
  const chips = state.searchChips;

  // Если нет чипсов и пустой запрос — ничего не делаем
  if (!chips.length && !q?.trim()) { hideSuggestions(); return; }

  const query = q?.toLowerCase().trim() || '';

  // Фильтр событий: И по чипсам (если есть), И по тексту (если есть)
  let eventResults = state.rawAllEvents.map(normalizeEvent);

  // Фильтр по чипсам: событие должно содержать хотя бы один из тегов
  if (chips.length) {
    eventResults = eventResults.filter(ev => {
      if (!ev.tags || !ev.tags.length) return false;
      const evTags = Array.isArray(ev.tags) ? ev.tags : String(ev.tags).split(',').map(s => s.trim());
      return chips.some(chip => evTags.some(t => t.toLowerCase() === chip.toLowerCase()));
    });
  }

  // Фильтр по тексту
  if (query) {
    eventResults = eventResults.filter(ev =>
      ev.title.toLowerCase().includes(query)   ||
      ev.venue.toLowerCase().includes(query)   ||
      ev.address.toLowerCase().includes(query) ||
      ev.desc.toLowerCase().includes(query)
    );
  }

  // Поиск мест (только по тексту, без чипсов)
  const placeResults = query ? searchPlaces(q) : [];

  _showSuggestions(eventResults, placeResults);
}

export function hideSuggestions() {
  const el = $('search-suggestions');
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}

function _showSuggestions(eventResults, placeResults) {
  const el = $('search-suggestions');
  if (!el) return;

  const allResults = [];

  // Place results (up to 3)
  if (placeResults?.length) {
    placeResults.slice(0, 3).forEach(p => {
      allResults.push({ type: 'place', place: p });
    });
  }

  // Event results (up to 5)
  if (eventResults?.length) {
    eventResults.slice(0, 5).forEach(ev => {
      allResults.push({ type: 'event', event: ev });
    });
  }

  if (!allResults.length) { hideSuggestions(); return; }

  el.innerHTML = allResults.map(item => {
    if (item.type === 'place') {
      const p = item.place;
      return `
        <div class="sug-item" data-type="place" data-place-id="${p.id}">
          <div class="sug-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="6"/>
            </svg>
          </div>
          <div>
            <div class="sug-text">${p.name}</div>
            <div class="sug-sub">${p.address || 'Место'}</div>
          </div>
        </div>`;
    } else {
      const ev = item.event;
      return `
        <div class="sug-item" data-type="event" data-id="${ev.id}">
          <div class="sug-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div>
            <div class="sug-text">${ev.title}</div>
            <div class="sug-sub">${ev.venue} · ${ev.time || ev.date}</div>
          </div>
        </div>`;
    }
  }).join('');

  el.querySelectorAll('.sug-item').forEach(item => {
    item.addEventListener('click', async () => {
      const type = item.getAttribute('data-type');
      if (type === 'place') {
        const pid = item.getAttribute('data-place-id');
        closeCard();
        const p = getPlaceById(pid);
        if (p) flyToPlace(p);
        openPlaceCard(pid);
      } else {
        const id = item.getAttribute('data-id');
        const ev = state.rawAllEvents.map(normalizeEvent).find(e => e.id === id);
        if (ev) {
          if (ev.date !== fmt(state.currentDate)) await _onDateChange?.(ev.date);
          flyTo(ev);
          _onOpenCard?.(id);
        }
      }
      hideSuggestions();
      const inp = $('search-input');
      if (inp) inp.value = '';
    });
  });

  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
}