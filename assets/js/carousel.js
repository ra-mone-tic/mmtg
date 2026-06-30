// ─── Poster Carousel ────────────────────────────────
import { $, fmt } from './helpers.js';
import { state } from './state.js';
import { normalizeEvent, parseDate } from './data.js';
import { flyTo } from './map-core.js';

// Коллбэки, переданные при инициализации
let _onOpenCard  = null;
let _onSetPanel  = null;
let _onDateChange = null;
let _onClosePlaceCard = null;

export function initCarousel({ onOpenCard, onSetPanel, onDateChange, onClosePlaceCard }) {
  _onOpenCard   = onOpenCard;
  _onSetPanel   = onSetPanel;
  _onDateChange = onDateChange;
  _onClosePlaceCard = onClosePlaceCard;
}

export function renderCarousel() {
  const track = $('poster-track');
  if (!track || !state.rawAllEvents?.length) return;

  state.carouselLoadedCount = 12;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sorted = state.rawAllEvents
    .map(normalizeEvent)
    .filter(e => { const d = parseDate(e.date); return d && d >= today; })
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));

  // Группируем многодневные: показываем только первое событие из группы (одинаковый title)
  const seenTitles = new Set();
  window._allUpcoming = [];
  for (const ev of sorted) {
    const key = ev.title.toLowerCase().trim();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      window._allUpcoming.push(ev);
    }
  }

  if (!window._allUpcoming.length) return;
  track.innerHTML = '';
  _renderBatch();
  _setupLazyLoad();
}

function _renderBatch() {
  const track    = $('poster-track');
  const upcoming = window._allUpcoming || [];
  if (!track) return;

  const end = Math.min(state.carouselLoadedCount, upcoming.length);
  for (let i = track.children.length; i < end; i++) {
    track.appendChild(_buildCard(upcoming[i]));
  }

  // Восстанавливаем позицию скролла
  if (state.carouselScrollPos > 0) {
    requestAnimationFrame(() => { track.scrollLeft = state.carouselScrollPos; });
  }
  _updateObserver();
}

function _buildCard(ev) {
  const card = document.createElement('div');
  card.className = 'poster-card';
  card.setAttribute('role', 'button');
  card.setAttribute('data-id', ev.id);
  card.setAttribute('tabindex', '0');

  const img = document.createElement('img');
  img.src     = ev.imageUrl || 'assets/Group 27.png';
  img.alt     = ev.title || '';
  img.loading = 'lazy';
  img.onerror = () => { img.src = 'assets/Group 27.png'; img.onerror = null; };
  card.appendChild(img);

  const ov = document.createElement('div');
  ov.className = 'poster-overlay';
  ov.innerHTML = `<div class="poster-title">${ev.title}</div>
                  <div class="poster-date">${ev.date}</div>`;
  card.appendChild(ov);

  const go = async () => {
    const track = $('poster-track');
    if (track) state.carouselScrollPos = track.scrollLeft;
    _onClosePlaceCard?.();
    if (ev.date !== fmt(state.currentDate)) await _onDateChange?.(ev.date);
    flyTo(ev);
    _onOpenCard?.(ev.id);
    _onSetPanel?.(false);
  };
  card.addEventListener('click', go);
  card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  return card;
}

function _setupLazyLoad() {
  const track = $('poster-track');
  if (!track) return;
  state.carouselObserver?.disconnect();
  state.carouselObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const upcoming = window._allUpcoming || [];
      if (state.carouselLoadedCount < upcoming.length) {
        state.carouselLoadedCount += 8;
        _renderBatch();
      }
    });
  }, { root: track, rootMargin: '100px', threshold: 0 });
  _updateObserver();
}

function _updateObserver() {
  const track = $('poster-track');
  if (!track || !state.carouselObserver) return;
  const last = track.lastElementChild;
  if (last) state.carouselObserver.observe(last);
}
