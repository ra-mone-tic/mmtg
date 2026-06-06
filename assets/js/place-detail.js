// ─── Place Detail Modal ─────────────────────────────
import { $, fmt, posterGrad, dayName, ICONS } from './helpers.js';
import { state } from './state.js';
import { getPlaceById, getEventsForPlace } from './places.js';
import { flyTo } from './map-core.js';
import { showToast } from './toast.js';

let _onOpenEventCard = null;

export function initPlaceDetail({ onOpenEventCard }) {
  _onOpenEventCard = onOpenEventCard;
}

export function openPlaceDetail(id) {
  const place = getPlaceById(id);
  if (!place) return;

  // Poster
  const poster = $('place-detail-poster');
  if (poster) poster.style.background = posterGrad(place.id);

  const posterInner = $('place-poster-inner');
  const posterInitial = $('place-poster-initial');
  if (posterInner) {
    posterInner.innerHTML = '';
    const imageUrl = place.imageUrl?.trim() || null;
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = place.name;
      img.loading = 'lazy';
      img.onerror = () => {
        posterInner.innerHTML = _placeholderImg(place.name);
      };
      img.onload = () => {
        posterInner.innerHTML = '';
        posterInner.appendChild(img);
      };
      posterInner.appendChild(img);
    } else {
      posterInner.innerHTML = _placeholderImg(place.name);
    }
  }

  // Text content
  const elAddress = $('place-detail-address');
  const elTitle   = $('place-detail-title');
  const elMeta    = $('place-detail-meta');
  const elDesc    = $('place-detail-desc');

  if (elAddress) elAddress.textContent = place.address || place.name;
  if (elTitle)   elTitle.textContent = place.name;
  if (elMeta) {
    let meta = '';
    meta += `<div class="meta-row">${ICONS.PIN}${place.address || '—'}</div>`;
    if (place.time) meta += `<div class="meta-row">${ICONS.CLK}${place.time}</div>`;
    elMeta.innerHTML = meta;
  }
  if (elDesc) elDesc.textContent = place.description || '';

  // Upcoming events at this place
  const eventsSection = $('place-events-section');
  const eventsList    = $('place-events-list');
  if (eventsSection && eventsList) {
    const upcoming = getEventsForPlace(place);
    if (upcoming.length) {
      eventsSection.style.display = '';
      eventsList.innerHTML = upcoming.map(ev => {
        const dateDisplay = ev.date === fmt(new Date()) ? 'Сегодня' : dayName(ev.date);
        return `
          <div class="place-event-item" data-event-id="${ev.id}">
            <div class="place-event-dot"></div>
            <div class="place-event-info">
              <div class="place-event-name">${ev.title}</div>
              <div class="place-event-date">${dateDisplay} · ${ev.time || ''}</div>
            </div>
          </div>`;
      }).join('');

      eventsList.querySelectorAll('.place-event-item').forEach(item => {
        item.addEventListener('click', () => {
          const evId = item.getAttribute('data-event-id');
          closePlaceDetail();
          _onOpenEventCard?.(evId);
        });
      });
    } else {
      eventsSection.style.display = '';
      eventsList.innerHTML = '<p class="place-events-empty">Пока нет предстоящих событий</p>';
    }
  }

  // Share button
  const btnShare = $('btn-place-detail-share');
  if (btnShare) {
    btnShare.onclick = () => {
      const url = window.location.origin + window.location.pathname + '?place=' + id;
      if (navigator.share) {
        navigator.share({ title: place.name, url }).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
      }
    };
  }

  // Open modal
  const modal = $('place-detail');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }

  const body = $('place-detail-body');
  if (body) body.scrollTop = 0;

  history.pushState({ meowPlaceDetail: true }, '');
}

export function closePlaceDetail() {
  const modal = $('place-detail');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
}

// ── Internal ───────────────────────────────────────

function _placeholderImg(name) {
  return `<img src="assets/Group 27.png" alt="${name || ''}"
               style="width:40%;height:40%;object-fit:contain;margin:auto;display:block;">`;
}