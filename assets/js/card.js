// \u2500\u2500\u2500 Event Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
import { $, metaHTML, renderTags, blocksHTML } from './helpers.js';
import { state } from './state.js';
import { clearPinsActive, setPinActive } from './map-core.js';
import { shareEvent } from './share.js';
import { syncActive } from './events-list.js';
import { searchPlaces } from './places.js';

let _onOpenDetail = null;
let _onOpenPlace = null;

export function initCard({ onOpenDetail, onOpenPlace }) {
  _onOpenDetail = onOpenDetail;
  _onOpenPlace = onOpenPlace;

  // ResizeObserver \u2014 \u043f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u044b\u0432\u0430\u0435\u043c \u043f\u043e\u0437\u0438\u0446\u0438\u044e \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u043e\u0432 \u043f\u0440\u0438 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0438 \u0432\u044b\u0441\u043e\u0442\u044b \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438
  const card = $('event-card');
  if (card) new ResizeObserver(() => { if (state.activeId) shiftControls(true); }).observe(card);
}

// \u2500\u2500 \u041e\u0442\u043a\u0440\u044b\u0442\u0438\u0435/\u0437\u0430\u043a\u0440\u044b\u0442\u0438\u0435 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export function openCard(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;

  // Сбрасываем выделение со всех маркеров и подсвечиваем выбранный
  clearPinsActive();
  state.activeId = id;
  setPinActive(id, true);

  const elVenue = $('card-venue');
  const elTitle = $('card-title');
  const elDesc  = $('card-desc');
  const elMeta  = $('card-meta');

  if (elVenue) {
    elVenue.textContent = ev.venue;
    // Проверяем, совпадает ли venue с каким-либо местом
    const venueTag = elVenue.closest('.venue-tag');
    if (venueTag) {
      const matchedPlace = state.rawPlaces.find(p =>
        p.keywords?.some(kw => ev.venue.toLowerCase().includes(kw.toLowerCase()))
      );
      if (matchedPlace) {
        venueTag.classList.add('is-link');
        venueTag.onclick = (e) => {
          e.stopPropagation();
          closeCard?.();
          _onOpenPlace?.(matchedPlace.id);
        };
      } else {
        venueTag.classList.remove('is-link');
        venueTag.onclick = null;
      }
    }
  }
  if (elTitle) elTitle.textContent = ev.title;
  if (elDesc)  elDesc.innerHTML    = blocksHTML(ev);
  // \u0414\u043b\u044f \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u043d\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u0430\u0434\u0440\u0435\u0441 (\u043e\u043d \u0443\u0436\u0435 \u0432 venue-tag)
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
  // НЕ сбрасываем выделение маркера при закрытии карточки.
  // Выделение снимается только при выборе другого маркера (в openCard)
  // или при выборе дат в календаре (в openCalendar).
  state.activeId = null;

  const card = $('event-card');
  if (card) { card.classList.remove('open'); card.setAttribute('aria-hidden', 'true'); }
  shiftControls(false);
  syncActive(null);
}

// \u2500\u2500 \u0421\u043c\u0435\u0449\u0435\u043d\u0438\u0435 \u043a\u043d\u043e\u043f\u043e\u043a \u043a\u0430\u0440\u0442\u044b \u043f\u0440\u0438 \u043e\u0442\u043a\u0440\u044b\u0442\u043e\u0439 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0435 \u2500\u2500\u2500\u2500

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
