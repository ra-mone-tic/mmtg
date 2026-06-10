// ─── Event Detail Modal ─────────────────────────────
import { $, metaHTML, renderTags, blocksHTML, posterGrad, TG } from './helpers.js';
import { state } from './state.js';
import { shareEvent } from './share.js';
import { showToast } from './toast.js';
import { addChip } from './search.js';
import { openPlaceDetail } from './place-detail.js';
import { isAuthed } from './auth.js';
import { toggleFavorite, isFavorited, mountFavButton } from './favorites.js';
import { toggleGoing, isGoing, getGoers, renderWhoGoing, subscribeGoers, unsubscribeGoers } from './social.js';
import { openReport } from './report.js';

export function openDetail(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  state.detailId = id;

  // Постер
  const poster = $('detail-poster');
  if (poster) {
    poster.style.background = posterGrad(ev.id);
    // Сбрасываем состояние expanded
    poster.classList.remove('expanded');
  }

  const posterInner = $('poster-inner');
  if (posterInner) {
    posterInner.innerHTML = '';
    const imageUrl = ev.imageUrl?.trim() || null;
    if (imageUrl) {
      state.detailHasImage = true;
      const img = document.createElement('img');
      img.src     = imageUrl;
      img.alt     = ev.title;
      img.loading = 'lazy';
      img.onerror = () => {
        state.detailHasImage = false;
        if (poster) poster.style.cursor = 'default';
        posterInner.innerHTML = _placeholderImg(ev.title);
      };
      img.onload  = () => {
        state.detailHasImage = true;
        if (poster) poster.style.cursor = 'zoom-in';
        posterInner.innerHTML = '';
        posterInner.appendChild(img);
      };
      posterInner.appendChild(img);
    } else {
      state.detailHasImage = false;
      if (poster) poster.style.cursor = 'default';
      posterInner.innerHTML = _placeholderImg(ev.title);
    }
  }

  // Текстовое содержимое
  const elVenue = $('detail-venue');
  const elTitle = $('detail-title');
  const elMeta  = $('detail-meta');
  const elDesc  = $('detail-desc');

  if (elVenue) elVenue.textContent = ev.venue;
  if (elTitle) elTitle.textContent = ev.title;
  if (elMeta)  elMeta.innerHTML    = metaHTML(ev, false);
  // При клике на тег в деталке — сначала закрываем деталку, потом добавляем чипс
  renderTags(ev.tags, 'detail-tags', tag => {
    closeDetail();
    addChip(tag);
  });
  if (elDesc)  elDesc.innerHTML    = blocksHTML(ev);

  // Делаем venue-tag кликабельным, если место совпадает
  const venueTag = elVenue?.closest('.detail-venue-tag');
  if (venueTag) {
    const matchedPlace = state.rawPlaces.find(p =>
      p.keywords?.some(kw => ev.venue.toLowerCase().includes(kw.toLowerCase()))
    );
    if (matchedPlace) {
      venueTag.classList.add('is-link');
      venueTag.onclick = (e) => {
        e.stopPropagation();
        closeDetail();
        openPlaceDetail(matchedPlace.id);
      };
    } else {
      venueTag.classList.remove('is-link');
      venueTag.onclick = null;
    }
  }

  // ── Social actions row (favorite + going) ──────────
  const socialRow = $('detail-social-actions');
  if (socialRow) {
    // Favorite button
    const favWrap = socialRow.querySelector('.fav-wrap');
    if (favWrap) mountFavButton(favWrap, ev.id);

    // Going button
    const goingBtn = socialRow.querySelector('.btn-going');
    if (goingBtn) {
      const going = isGoing(ev.id);
      goingBtn.classList.toggle('active', going);
      goingBtn.textContent = going ? '✅ Идёшь' : '✓ Пойду';
      goingBtn.onclick = async () => {
        if (!isAuthed()) { showToast('Войдите через Telegram'); return; }
        await toggleGoing(ev.id);
        const now = isGoing(ev.id);
        goingBtn.classList.toggle('active', now);
        goingBtn.textContent = now ? '✅ Идёшь' : '✓ Пойду';
        // Refresh who's going
        const wgContainer = $('detail-who-going');
        if (wgContainer) renderWhoGoing(wgContainer, ev.id);
      };
    }
    socialRow.style.display = '';
  }

  // ── Who's going section ────────────────────────────
  const whoGoing = $('detail-who-going');
  if (whoGoing) {
    renderWhoGoing(whoGoing, ev.id);

    // Unsubscribe previous goers channel before creating a new one
    if (state._goersChannel) {
      unsubscribeGoers(state._goersChannel);
      state._goersChannel = null;
    }

    // Subscribe to realtime changes (unique channel per event)
    state._goersChannel = subscribeGoers(ev.id, () => renderWhoGoing(whoGoing, ev.id));
  }

  // ── Report button ──────────────────────────────────
  const btnReport = $('btn-detail-report');
  if (btnReport) {
    btnReport.onclick = () => openReport('event', ev.id, ev.title);
    btnReport.style.display = '';
  }

  // Кнопки
  const btnContacts    = $('btn-contacts');
  const btnDetailShare = $('btn-detail-share');
  if (btnContacts)    btnContacts.onclick    = () => _openContacts(ev);
  if (btnDetailShare) btnDetailShare.onclick = () => shareEvent(ev);

  // Открываем модал
  const modal = $('event-detail');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }

  const body = $('detail-body');
  if (body) body.scrollTop = 0;

  TG()?.HapticFeedback?.selectionChanged();
}

export function closeDetail() {
  const modal = $('event-detail');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  state.detailId = null;
  // Hide social actions
  const socialRow = $('detail-social-actions');
  if (socialRow) socialRow.style.display = 'none';
  const whoGoing = $('detail-who-going');
  if (whoGoing) whoGoing.innerHTML = '';
  const btnReport = $('btn-detail-report');
  if (btnReport) btnReport.style.display = 'none';
  TG()?.HapticFeedback?.impactOccurred('light');
}

// ── Внутренние утилиты ──────────────────────────────

function _placeholderImg(title) {
  return `<img src="assets/Group 27.png" alt="${title || ''}"
               style="width:40%;height:40%;object-fit:contain;margin:auto;display:block;">`;
}

function _openContacts(ev) {
  TG()?.HapticFeedback?.impactOccurred('light');
  if (!ev.contacts) { showToast('Контакты недоступны'); return; }
  const c = ev.contacts.trim();
  try {
    if (
      c.startsWith('http') || c.startsWith('https') || c.startsWith('tg://') ||
      /^t\.me\//i.test(c)  || /^telegram\.me\//i.test(c)
    ) {
      window.open(c.startsWith('http') || c.startsWith('tg://') ? c : 'https://' + c, '_blank');
    } else if (c.startsWith('@')) {
      window.open('https://t.me/' + c.slice(1), '_blank');
    } else {
      showToast('Контакты: ' + c);
    }
  } catch (_) { showToast('Не удалось открыть контакт'); }
}