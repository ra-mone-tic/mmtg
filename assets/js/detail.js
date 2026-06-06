// ─── Event Detail Modal ──────────────────────────────
import { $, metaHTML, renderTags, posterGrad, TG } from './helpers.js';
import { state } from './state.js';
import { shareEvent } from './share.js';
import { showToast } from './toast.js';

export function openDetail(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  state.detailId = id;

  // Постер
  const poster = $('detail-poster');
  if (poster) poster.style.background = posterGrad(ev.id);

  const posterInner = $('poster-inner');
  if (posterInner) {
    posterInner.innerHTML = '';
    const imageUrl = ev.imageUrl?.trim() || null;
    if (imageUrl) {
      const img = document.createElement('img');
      img.src     = imageUrl;
      img.alt     = ev.title;
      img.loading = 'lazy';
      img.onerror = () => { posterInner.innerHTML = _placeholderImg(ev.title); };
      img.onload  = () => { posterInner.innerHTML = ''; posterInner.appendChild(img); };
      posterInner.appendChild(img);
    } else {
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
  renderTags(ev.tags, 'detail-tags');
  if (elDesc)  elDesc.textContent  = ev.desc;

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
  history.pushState({ meowDetail: true }, '');
}

export function closeDetail() {
  const modal = $('event-detail');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  state.detailId = null;
  TG()?.HapticFeedback?.impactOccurred('light');
}

// ── Внутренние утилиты ───────────────────────────────

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
