// ─── Event Card ──────────────────────────────────────
import { $, metaHTML, renderTags } from './helpers.js';
import { state } from './state.js';
import { setPinActive } from './map-core.js';
import { shareEvent } from './share.js';
import { syncActive } from './events-list.js';

let _onOpenDetail = null;

export function initCard({ onOpenDetail }) {
  _onOpenDetail = onOpenDetail;

  // ResizeObserver — пересчитываем позицию контролов при изменении высоты карточки
  const card = $('event-card');
  if (card) new ResizeObserver(() => { if (state.activeId) shiftControls(true); }).observe(card);
}

// ── Открытие/закрытие карточки ───────────────────────

export function openCard(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;

  if (state.activeId && state.activeId !== id) setPinActive(state.activeId, false);
  state.activeId = id;
  setPinActive(id, true);

  const elVenue = $('card-venue');
  const elTitle = $('card-title');
  const elDesc  = $('card-desc');
  const elMeta  = $('card-meta');

  if (elVenue) elVenue.textContent = ev.venue;
  if (elTitle) elTitle.textContent = ev.title;
  if (elDesc)  elDesc.textContent  = ev.desc;
  // Для карточки не показываем адрес (он уже в venue-tag)
  if (elMeta)  elMeta.innerHTML    = metaHTML(ev, false);
  renderTags(ev.tags, 'card-tags');

  const btnLearnMore = $('btn-learn-more');
  const btnShare     = $('btn-share');
  if (btnLearnMore) btnLearnMore.onclick = () => _onOpenDetail?.(id);
  if (btnShare)     btnShare.onclick     = () => shareEvent(ev);

  const card = $('event-card');
  if (card) { card.classList.add('open'); card.setAttribute('aria-hidden', 'false'); }
  shiftControls(true);
  syncActive(id);
}

export function closeCard() {
  if (!state.activeId) return;
  setPinActive(state.activeId, false);
  state.activeId = null;

  const card = $('event-card');
  if (card) { card.classList.remove('open'); card.setAttribute('aria-hidden', 'true'); }
  shiftControls(false);
  syncActive(null);
}

// ── Смещение кнопок карты при открытой карточке ──────

function _ctrlBase() {
  return ($('bottom-bar')?.offsetHeight ?? 62) + 12;
}

export function shiftControls(cardOpen) {
  const ctrl = $('map-controls');
  if (!ctrl) return;
  ctrl.style.bottom = cardOpen
    ? (_ctrlBase() + ($('event-card')?.offsetHeight ?? 0) + 12) + 'px'
    : _ctrlBase() + 'px';
}
