// ─── Place Detail Modal ─────────────────────────────
import { $, fmt, posterGrad, dayName, ICONS } from './helpers.js';
import { isAdmin } from './auth.js';
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
  if (poster) {
    poster.style.background = posterGrad(place.id);
    poster.classList.remove('expanded');
  }

  const posterInner = $('place-poster-inner');
  const posterInitial = $('place-poster-initial');
  if (posterInner) {
    posterInner.innerHTML = '';
    const imageUrl = place.imageUrl?.trim() || null;
    if (imageUrl) {
      state.placeDetailHasImage = true;
      if (poster) poster.style.cursor = 'zoom-in';
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = place.name;
      img.loading = 'lazy';
      const onImageFail = () => {
        state.placeDetailHasImage = false;
        if (poster) poster.style.cursor = 'default';
        posterInner.innerHTML = _placeholderImg(place.name);
      };
      img.onerror = onImageFail;
      img.onabort = onImageFail;
      img.onload = () => {
        state.placeDetailHasImage = true;
        if (poster) poster.style.cursor = 'zoom-in';
        posterInner.innerHTML = '';
        posterInner.appendChild(img);
      };
      posterInner.appendChild(img);
    } else {
      state.placeDetailHasImage = false;
      if (poster) poster.style.cursor = 'default';
      posterInner.innerHTML = _placeholderImg(place.name);
    }
  }

  // Text content
  const elTitle   = $('place-detail-title');
  const elMeta    = $('place-detail-meta');
  const elDesc    = $('place-detail-desc');

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

  // Admin: edit place button
  const adminRow = $('place-admin-actions');
  if (adminRow) adminRow.remove();
  if (isAdmin()) {
    const detailBody = $('place-detail-body');
    if (detailBody) {
      const div = document.createElement('div');
      div.id = 'place-admin-actions';
      div.style.cssText = 'display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--c-soft-br)';
      div.innerHTML = `
        <button class="btn-admin-detail edit" id="place-admin-edit" style="flex:1;height:38px;border-radius:var(--r-b);background:var(--c-glass);border:1.5px solid var(--c-glass-br);color:var(--c-accent);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:5px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Редактировать место
        </button>
      `;
      detailBody.appendChild(div);
      div.querySelector('#place-admin-edit')?.addEventListener('click', async () => {
        closePlaceDetail();
        const mod = await import('./admin.js');
        // For places, we reuse the admin panel (future: dedicated place form)
        mod.openAdminPanel();
      });
    }
  }

  // Open modal
  const modal = $('place-detail');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }

  const body = $('place-detail-body');
  if (body) body.scrollTop = 0;
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