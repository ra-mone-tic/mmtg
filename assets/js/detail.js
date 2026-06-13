// ─── Event Detail Modal ─────────────────────────────
import { $, metaHTML, renderTags, blocksHTML, posterGrad, TG } from './helpers.js';
import { state } from './state.js';
import { shareEvent } from './share.js';
import { showToast } from './toast.js';
import { addChip } from './search.js';
import { openPlaceDetail } from './place-detail.js';
import { isAuthed, isAdmin } from './auth.js';
import { toggleFavorite, isFavorited, mountFavButton } from './favorites.js';
import { toggleGoing, isGoing, getGoers, renderWhoGoing, subscribeGoers, unsubscribeGoers } from './social.js';
import { openReport } from './report.js';
import { renderLookingSection } from './looking.js';

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
    const matchedPlace = state.rawPlaces.find(p => {
      const venueLower = ev.venue.toLowerCase();
      const kw = p.keywords || [];
      // Сначала ищем по keywords
      if (kw.some(k => venueLower.includes(k.toLowerCase()))) return true;
      // Fallback: ищем по названию места
      if (p.name && venueLower.includes(p.name.toLowerCase())) return true;
      return false;
    });
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

  // ── Admin actions (edit/delete) ────────────────────
  if (isAdmin()) {
    let adminRow = $('detail-admin-actions');
    if (!adminRow) {
      // Insert admin row into detail-body
      const detailBody = $('detail-body');
      if (detailBody) {
        const div = document.createElement('div');
        div.id = 'detail-admin-actions';
        div.className = 'detail-admin-actions';
        div.style.cssText = 'display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--c-soft-br)';
        div.innerHTML = `
          <button class="btn-admin-detail edit" data-event-id="${ev.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Редактировать
          </button>
          <button class="btn-admin-detail delete" data-event-id="${ev.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            Удалить
          </button>
        `;
        detailBody.appendChild(div);
        adminRow = div;
      }
    }
    if (adminRow) {
      adminRow.style.display = 'flex';
      // Update IDs
      adminRow.querySelectorAll('.btn-admin-detail').forEach(btn => {
        btn.dataset.eventId = ev.id;
      });
      // Bind edit
      adminRow.querySelector('.btn-admin-detail.edit')?.addEventListener('click', async () => {
        closeDetail();
        const mod = await import('./admin.js');
        mod.openAdminEdit(ev.id);
      });
      // Bind delete
      adminRow.querySelector('.btn-admin-detail.delete')?.addEventListener('click', async () => {
        if (!confirm('Удалить мероприятие "' + ev.title + '"?')) return;
        try {
          const { supabase } = await import('./supabase.js');
          const { error } = await supabase.from('events').delete().eq('id', ev.id);
          if (error) throw error;
          closeDetail();
          const { loadAllEvents } = await import('./data.js');
          await loadAllEvents();
          showToast('Удалено');
          // Trigger re-render of markers
          document.dispatchEvent(new CustomEvent('meow:events-changed'));
        } catch (err) {
          showToast('Ошибка: ' + (err.message || err));
        }
      });
    }
  }

  // ── Looking for company section ────────────────────
  const lookingContainer = $('detail-looking');
  if (lookingContainer) {
    renderLookingSection(lookingContainer, ev.id);
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
  const lookingContainer = $('detail-looking');
  if (lookingContainer) lookingContainer.innerHTML = '';
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