// ─── Place Card ─────────────────────────────────────
import { $, ICONS, posterGrad } from './helpers.js';
import { state } from './state.js';
import { getPlaceById } from './places.js';
import { setPlaceDotActive, clearPlaceDotsActive, flyToPlace } from './map-core.js';

let _onOpenDetail = null;
let _onOpenEventCard = null;

export function initPlaceCard({ onOpenDetail, onOpenEventCard }) {
  _onOpenDetail = onOpenDetail;
  _onOpenEventCard = onOpenEventCard;

  const card = $('place-card');
  if (card) new ResizeObserver(() => { if (state.activePlaceId) shiftPlaceControls(true); }).observe(card);
}

export function openPlaceCard(id) {
  const place = getPlaceById(id);
  if (!place) return;

  // Сброс активного маркера события
  clearPlaceDotsActive();
  state.activePlaceId = id;
  setPlaceDotActive(id, true);

  const elTitle   = $('place-card-title');
  const elDesc    = $('place-card-desc');
  const elMeta    = $('place-card-meta');

  if (elTitle)   elTitle.textContent = place.name;
  if (elDesc)    elDesc.textContent = place.description || '';
  if (elMeta) {
    let meta = '';
    if (place.address) meta += `<div class="meta-row">${ICONS.PIN}${place.address}</div>`;
    if (place.time) meta += `<div class="meta-row">${ICONS.CLK}${place.time}</div>`;
    elMeta.innerHTML = meta;
  }

  const btnLearnMore = $('btn-place-learn-more');
  const btnShare     = $('btn-place-share');
  if (btnLearnMore) btnLearnMore.onclick = () => _onOpenDetail?.(id);
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

  const card = $('place-card');
  if (card) { card.classList.add('open'); card.setAttribute('aria-hidden', 'false'); }
  shiftPlaceControls(true);
}

export function closePlaceCard() {
  if (!state.activePlaceId) return;
  state.activePlaceId = null;

  const card = $('place-card');
  if (card) { card.classList.remove('open'); card.setAttribute('aria-hidden', 'true'); }
  shiftPlaceControls(false);
  clearPlaceDotsActive();
}

function _ctrlBase() {
  return ($('bottom-bar')?.offsetHeight ?? 62) + 12;
}

function shiftPlaceControls(cardOpen) {
  const ctrl = $('map-controls');
  if (!ctrl) return;
  // Only shift if event card is NOT open
  if (state.activeId) return;
  ctrl.style.bottom = cardOpen
    ? (_ctrlBase() + ($('place-card')?.offsetHeight ?? 0) + 12) + 'px'
    : _ctrlBase() + 'px';
}