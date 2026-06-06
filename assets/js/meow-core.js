/**
 * MeowAfisha · meow-core.js
 *
 * Точка входа приложения: функция boot() инициализирует все модули
 * и подвязывает обработчики событий.
 *
 * Бизнес-логика вынесена в модули:
 *   config.js · helpers.js · state.js · toast.js
 *   theme.js  · avatar.js  · share.js  · data.js
 *   carousel.js · events-list.js · card.js · detail.js
 *   calendar.js · search.js · map-core.js
 */

import {
  initMap as mapInit,
  addMarkers, clearMarkers, setPinActive,
  flyTo, getMapInstance, addUserMarker,
} from './map-core.js';

import { CFG }                                       from './config.js';
import { $, fmt, TG }                               from './helpers.js';
import { state }                                    from './state.js';
import { showToast }                                from './toast.js';
import { initTheme, applyTheme }                    from './theme.js';
import { initAvatar }                               from './avatar.js';
import { loadAllEvents, filterByDate, filterByDates, findNearestDate, normalizeEvent } from './data.js';
import { initCarousel, renderCarousel }             from './carousel.js';
import { initEventsList, renderList, setPanel, applyPanelFilter } from './events-list.js';
import { initCard, openCard, closeCard, shiftControls } from './card.js';
import { openDetail, closeDetail }                  from './detail.js';
import { initCalendar, openCalendar, closeCalendar, setMultiApplyHandler } from './calendar.js';
import { initSearch, handleSearch, hideSuggestions } from './search.js';

// ─── Внутренние хелперы ──────────────────────────────

async function onDateChange(dateStr) {
  const dateLabel = $('date-label');
  if (dateLabel) dateLabel.textContent = dateStr;
  const [day, month, year] = dateStr.split('.').map(Number);
  state.currentDate = new Date(year, month - 1, day);
  // Сброс мультивыбора при одиночном выборе даты
  state.multiSelect = false;
  state.selectedDates = [];
  await fetchEvents(dateStr);
}

/**
 * Применяет множественный выбор дат (из календаря).
 * Загружает все события на выбранные даты на карту.
 */
async function applyMultiDates(dates) {
  try {
    state.events = filterByDates(dates);
    state.allEvents = state.events;
  } catch (e) {
    state.events = [];
    console.error('[MEOW]', e);
  }
  if (getMapInstance()?.loaded()) renderMarkers(state.events);
  renderList(state.events);
}

async function fetchEvents(dateStr) {
  try {
    state.events = filterByDate(dateStr);
    state.allEvents = state.events;
  } catch (e) {
    state.events = [];
    console.error('[MEOW]', e);
  }
  if (getMapInstance()?.loaded()) renderMarkers();
  renderList();
}

function renderMarkers(eventList) {
  clearMarkers();
  addMarkers(eventList ?? state.events, ev => {
    openCard(ev.id);
    flyTo(ev);
  });
  if (state.activeId) setPinActive(state.activeId, true);
}

// ─── Boot ────────────────────────────────────────────

export async function boot() {
  // Telegram WebApp
  const webapp = TG();
  webapp?.ready();
  webapp?.expand();

  // Тема
  state.theme = initTheme();
  requestAnimationFrame(() => applyTheme(state.theme, false));

  // Аватар
  initAvatar();

  // Данные
  await loadAllEvents();

  // Стартовая дата: сегодня или ближайшая с событиями
  state.currentDate = new Date(); state.currentDate.setHours(0, 0, 0, 0);
  const todayStr = fmt(state.currentDate);
  if (!filterByDate(todayStr).length) {
    const nearest = findNearestDate();
    if (nearest) {
      const [d, m, y] = nearest.split('.').map(Number);
      state.currentDate = new Date(y, m - 1, d);
    }
  }

  const dateLabel = $('date-label');
  if (dateLabel) dateLabel.textContent = fmt(state.currentDate);

  // Инициализация модулей с callbacks
  initCard({ onOpenDetail: openDetail });
  initCarousel({ onOpenCard: openCard, onSetPanel: setPanel, onDateChange });
  initEventsList({ onOpenCard: openCard, onDateChange });
  initCalendar({ onDateChange });
  setMultiApplyHandler(applyMultiDates);
  initSearch({ onOpenCard: openCard, onDateChange });

  // Карта
  mapInit({
    theme     : state.theme,
    center    : CFG.MAP_CENTER,
    zoom      : CFG.MAP_ZOOM,
    bbox      : CFG.BBOX,
    onMapReady: () => { $('loading')?.classList.add('gone'); renderMarkers(); },
    onMapClick: () => closeCard(),
  });

  requestAnimationFrame(() => requestAnimationFrame(() => shiftControls(false)));

  // Загружаем события стартовой даты
  await fetchEvents(fmt(state.currentDate));

  // Карусель
  renderCarousel();

  // ── Deep linking: ?event=ID ──────────────────────────
  const eventId = new URLSearchParams(window.location.search).get('event');
  if (eventId) {
    const ev = state.rawAllEvents.map(normalizeEvent).find(e => e.id === eventId);
    if (ev) {
      if (ev.date !== fmt(state.currentDate)) await onDateChange(ev.date);
      setTimeout(() => { flyTo(ev); openCard(ev.id); }, 100);
    }
  }

  // ── Listeners ────────────────────────────────────────

  // Тема
  $('btn-theme')?.addEventListener('click', () => {
    state.theme = applyTheme(
      state.theme === 'light' ? 'dark' : 'light',
      true,
      renderMarkers
    );
  });

  // Аватар
  $('btn-avatar')?.addEventListener('click', () => {
    const user = TG()?.initDataUnsafe?.user;
    if (!user) return;
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    if (TG()?.showPopup) {
      TG().showPopup({ title: 'Профиль', message: name || 'Пользователь',
                       buttons: [{ type: 'close', text: 'Закрыть' }] });
    } else {
      showToast(name || '👤 Пользователь');
    }
  });

  // Панель событий
  let panelFilterMode = filterByDate(fmt(new Date())).length ? 'today' : 'all';
  const filterAll   = $('filter-all');
  const filterToday = $('filter-today');

  $('btn-events')?.addEventListener('click', () => {
    const willOpen = !state.panelOpen;
    setPanel(willOpen);
    if (willOpen) applyPanelFilter(panelFilterMode);
  });

  filterAll?.addEventListener('click', () => {
    panelFilterMode = 'all';
    applyPanelFilter('all');
    filterAll.classList.add('active');
    filterToday?.classList.remove('active');
  });
  filterToday?.addEventListener('click', () => {
    panelFilterMode = 'today';
    applyPanelFilter('today');
    filterToday.classList.add('active');
    filterAll?.classList.remove('active');
  });
  // Начальное состояние кнопок фильтра
  if (panelFilterMode === 'today') filterToday?.classList.add('active');
  else                              filterAll?.classList.add('active');

  // Карточка
  $('btn-close-card')?.addEventListener('click', closeCard);

  // Детальный экран
  $('btn-detail-back')?.addEventListener('click', () => {
    if (history.state?.meowDetail) history.back(); else closeDetail();
  });

  // Свайп вниз для закрытия детального экрана
  let swipeStartY = 0;
  const detailEl = $('event-detail');
  if (detailEl) {
    detailEl.addEventListener('touchstart', e => { swipeStartY = e.touches[0].clientY; }, { passive: true });
    detailEl.addEventListener('touchend',   e => {
      const body = $('detail-body');
      if (body?.scrollTop === 0 && e.changedTouches[0].clientY - swipeStartY > 72) closeDetail();
    }, { passive: true });
  }
  window.addEventListener('popstate', () => {
    if ($('event-detail')?.classList.contains('open')) closeDetail();
  });

  // Свайп вниз для закрытия карточки мероприятия
  let cardSwipeStartY = 0;
  const cardEl = $('event-card');
  if (cardEl) {
    cardEl.addEventListener('touchstart', e => { cardSwipeStartY = e.touches[0].clientY; }, { passive: true });
    cardEl.addEventListener('touchend',   e => {
      if (e.changedTouches[0].clientY - cardSwipeStartY > 72) closeCard();
    }, { passive: true });
  }

  // Зум на постер в детальном экране
  // Разворачиваем только если у мероприятия есть картинка
  $('detail-poster')?.addEventListener('click', e => {
    if (e.target.closest('.detail-back')) return;
    if (!state.detailHasImage) return;
    $('detail-poster').classList.toggle('expanded');
    TG()?.HapticFeedback?.impactOccurred('light');
  });

  // Дата
  $('btn-date')?.addEventListener('click', e => { e.stopPropagation(); openCalendar(); });

  // Карусель — кнопка скрыть/показать
  const posterCarousel     = $('poster-carousel');
  const btnCarouselToggle  = $('btn-carousel-toggle');
  if (btnCarouselToggle && posterCarousel) {
    btnCarouselToggle.addEventListener('click', () => {
      state.carouselVisible = !state.carouselVisible;
      posterCarousel.classList.toggle('hidden', !state.carouselVisible);
      btnCarouselToggle.setAttribute('aria-expanded', String(state.carouselVisible));
      btnCarouselToggle.setAttribute('aria-label',
        state.carouselVisible ? 'Скрыть карусель' : 'Показать карусель');
      TG()?.HapticFeedback?.impactOccurred('light');
    });
  }

  // Контролы карты
  $('btn-zoom-in')?.addEventListener('click',  () => getMapInstance()?.zoomIn({ duration: 270 }));
  $('btn-zoom-out')?.addEventListener('click', () => getMapInstance()?.zoomOut({ duration: 270 }));
  $('btn-locate')?.addEventListener('click',   () => _handleLocate());

  // Поиск
  let _searchTimer;
  const searchInput = $('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => handleSearch(e.target.value.trim()), 300);
    });
    searchInput.addEventListener('focus', () => {
      if (state.panelOpen) setPanel(false);
      closeCard();
      closeCalendar();
    });
    searchInput.addEventListener('blur', () => setTimeout(hideSuggestions, 200));
  }

  // Закрытие панели по клику вне неё
  const _closePanel = e => {
    if (state.panelOpen && !$('events-panel')?.contains(e.target) && e.target !== $('btn-events')) {
      setPanel(false);
    }
  };
  document.addEventListener('click',      _closePanel);
  document.addEventListener('touchstart', _closePanel);

  // Скрываем подсказки при касании карты
  $('map')?.addEventListener('touchstart', hideSuggestions, { passive: true });

  // Не пропускаем клики сквозь оверлеи
  ['events-panel','event-card','event-detail'].forEach(id => {
    $(id)?.addEventListener('click', e => e.stopPropagation());
  });

  console.log('[MEOW] Application initialized');
}

// ─── Геолокация ──────────────────────────────────────

function _handleLocate() {
  if (!navigator.geolocation) { showToast('Геолокация недоступна'); return; }
  TG()?.HapticFeedback?.impactOccurred('medium');
  navigator.geolocation.getCurrentPosition(
    ({ coords: { latitude, longitude, accuracy } }) => {
      if (accuracy > 50) console.warn(`[MEOW] Точность геолокации: ${accuracy}м`);
      const [minLon, minLat, maxLon, maxLat] = CFG.BBOX;
      if (latitude < minLat || latitude > maxLat || longitude < minLon || longitude > maxLon) {
        showToast('⚠️ Координаты вне региона. Проверьте GPS.');
        return;
      }
      addUserMarker(longitude, latitude);
      getMapInstance()?.flyTo({ center: [longitude, latitude], zoom: 15.5, duration: 700 });
      showToast(`📍 Точность: ${Math.round(accuracy)}м`);
    },
    err => {
      const msg = {
        1: '❌ Доступ к геолокации запрещён',
        2: '❌ Источник геолокации недоступен',
        3: '⏱️ Timeout при получении координат',
      }[err.code] ?? '❌ Не удалось получить координаты';
      showToast(msg);
      console.warn(`[MEOW] Geo error (${err.code}): ${err.message}`);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}
