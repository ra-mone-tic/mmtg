// ─── Search & Suggestions ────────────────────────────
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

export function handleSearch(q) {
  if (!q?.trim()) { hideSuggestions(); return; }
  const query   = q.toLowerCase().trim();

  // Search events
  const eventResults = state.rawAllEvents.map(normalizeEvent).filter(ev =>
    ev.title.toLowerCase().includes(query)   ||
    ev.venue.toLowerCase().includes(query)   ||
    ev.address.toLowerCase().includes(query) ||
    ev.desc.toLowerCase().includes(query)
  );

  // Search places
  const placeResults = searchPlaces(q);

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
