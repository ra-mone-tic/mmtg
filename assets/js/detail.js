// \u2500\u2500\u2500 Event Detail Modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
import { $, metaHTML, renderTags, blocksHTML, posterGrad, TG, showBackButton, hideBackButton } from './helpers.js';
import { state } from './state.js';
import { shareEvent } from './share.js';
import { showToast } from './toast.js';

export function openDetail(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  state.detailId = id;

  // \u041f\u043e\u0441\u0442\u0435\u0440
  const poster = $('detail-poster');
  if (poster) {
    poster.style.background = posterGrad(ev.id);
    // \u0421\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u043c \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 expanded
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

  // \u0422\u0435\u043a\u0441\u0442\u043e\u0432\u043e\u0435 \u0441\u043e\u0434\u0435\u0440\u0436\u0438\u043c\u043e\u0435
  const elVenue = $('detail-venue');
  const elTitle = $('detail-title');
  const elMeta  = $('detail-meta');
  const elDesc  = $('detail-desc');

  if (elVenue) elVenue.textContent = ev.venue;
  if (elTitle) elTitle.textContent = ev.title;
  if (elMeta)  elMeta.innerHTML    = metaHTML(ev, false);
  renderTags(ev.tags, 'detail-tags');
  if (elDesc)  elDesc.innerHTML    = blocksHTML(ev);

  // \u041a\u043d\u043e\u043f\u043a\u0438
  const btnContacts    = $('btn-contacts');
  const btnDetailShare = $('btn-detail-share');
  if (btnContacts)    btnContacts.onclick    = () => _openContacts(ev);
  if (btnDetailShare) btnDetailShare.onclick = () => shareEvent(ev);

  // \u041e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u043c \u043c\u043e\u0434\u0430\u043b
  const modal = $('event-detail');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }

  const body = $('detail-body');
  if (body) body.scrollTop = 0;

  TG()?.HapticFeedback?.selectionChanged();
  showBackButton();
  history.pushState({ meowDetail: true }, '');
}

export function closeDetail() {
  const modal = $('event-detail');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  state.detailId = null;
  hideBackButton();
  TG()?.HapticFeedback?.impactOccurred('light');
}

// \u2500\u2500 \u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u0443\u0442\u0438\u043b\u0438\u0442\u044b \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function _placeholderImg(title) {
  return `<img src="assets/Group 27.png" alt="${title || ''}"
               style="width:40%;height:40%;object-fit:contain;margin:auto;display:block;">`;
}

function _openContacts(ev) {
  TG()?.HapticFeedback?.impactOccurred('light');
  if (!ev.contacts) { showToast('\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b'); return; }
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
      showToast('\u041a\u043e\u043d\u0442\u0430\u043a\u0442\u044b: ' + c);
    }
  } catch (_) { showToast('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u043e\u043d\u0442\u0430\u043a\u0442'); }
}
