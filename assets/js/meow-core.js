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
  addPlaceDots, setPlaceDotActive, flyToPlace,
} from './map-core.js';

import { CFG }                                       from './config.js';
import { $, fmt, TG }                               from './helpers.js';
import { state }                                    from './state.js';
import { showToast }                                from './toast.js';
import { initTheme, applyTheme, bindTelegramTheme }  from './theme.js';
import { initAvatar }                               from './avatar.js';
import { loadAllEvents, filterByDate, filterByDates, findNearestDate, normalizeEvent } from './data.js';
import { initCarousel, renderCarousel }             from './carousel.js';
import { initEventsList, renderList, setPanel, applyPanelFilter } from './events-list.js';
import { initCard, openCard, closeCard, shiftControls } from './card.js';
import { openDetail, closeDetail }                  from './detail.js';
import { initCalendar, openCalendar, closeCalendar, setMultiApplyHandler } from './calendar.js';
import { initSearch, handleSearch, hideSuggestions } from './search.js';
import { loadPlaces, getPlaceById }                 from './places.js';
import { initPlaceCard, openPlaceCard, closePlaceCard } from './place-card.js';
import { initPlaceDetail, openPlaceDetail, closePlaceDetail } from './place-detail.js';

// ── Auth / Social / Profile / Notifications ────────────
import { initAuth }                                 from './auth.js';
import { loadFavorites }                            from './favorites.js';
import { loadGoing, loadFollowing }                 from './social.js';
import { openProfile, closeProfile }                from './profile.js';
import { initNotifications, handleOutsideClick as handleNotifOutside } from './notifications-ui.js';
import { closeReport }                              from './report.js';

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
    closePlaceCard();
    openCard(ev.id);
    flyTo(ev);
  });
  if (state.activeId) setPinActive(state.activeId, true);
}

// ─── Boot ────────────────────────────────────────────

export async function boot() {
  // Telegram WebApp — НЕ вызываем ready() сразу, ждём готовности UI
  const webapp = TG();
  webapp?.expand();
  // Скрыть главную кнопку
  webapp?.MainButton?.hide();

  // Тема
  state.theme = initTheme();
  applyTheme(state.theme, false);

  // Привязываем палитру Telegram к CSS-переменным (themeChanged + retry + старт)
  bindTelegramTheme();

  // Синхронизация MainButton с темой пользователя
  const syncMainButton = () => {
    try {
      const params = webapp?.themeParams;
      if (params?.button_color) {
        webapp.MainButton?.setParams({
          color:      params.button_color,
          text_color: params.button_text_color || '#ffffff',
          is_visible: false,
        });
      }
    } catch (_) { /* не критично */ }
  };
  syncMainButton();
  setTimeout(syncMainButton, 1000);
  setTimeout(syncMainButton, 3000);

  // ── Auth + Events + Places — параллельно ────────────
  // Auth не зависит от событий, события не зависят от auth.
  // Social и notifications загружаем ПОСЛЕ карты (fire & forget).
  initAvatar();

  await Promise.all([
    initAuth(),
    loadAllEvents(),
    loadPlaces(),
  ]);

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
  initCard({ onOpenDetail: openDetail, onOpenPlace: _onOpenPlace });
  initCarousel({ onOpenCard: openCard, onSetPanel: setPanel, onDateChange, onClosePlaceCard: closePlaceCard });
  initEventsList({ onOpenCard: openCard, onDateChange, onOpenPlaceCard: _onOpenPlace });
  initCalendar({ onDateChange });
  setMultiApplyHandler(applyMultiDates);
  initSearch({ onOpenCard: openCard, onDateChange });
  initPlaceCard({ onOpenDetail: openPlaceDetail });
  initPlaceDetail({ onOpenEventCard: _onOpenEventFromPlace });

  // Карта
  mapInit({
    theme     : state.theme,
    center    : CFG.MAP_CENTER,
    zoom      : CFG.MAP_ZOOM,
    bbox      : CFG.BBOX,
    onMapReady: () => {
      $('loading')?.classList.add('gone');

      // ✅ UI готов — теперь можно сообщить Telegram
      webapp?.ready();

      addPlaceDots(state.rawPlaces, p => {
        closeCard();
        openPlaceCard(p.id);
        flyToPlace(p);
      });
      renderMarkers();
    },
    onMapClick: () => { closeCard(); closePlaceCard(); },
  });

  requestAnimationFrame(() => requestAnimationFrame(() => shiftControls(false)));

  // Загружаем события стартовой даты
  await fetchEvents(fmt(state.currentDate));

  // ── Deferred: social + notifications (after UI ready) ──
  Promise.all([loadFavorites(), loadGoing(), loadFollowing()]).catch(() => {});
  initNotifications().catch(() => {});

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

  // Тема — переключение доступно только вне Telegram Mini App
  // (в Telegram тема определяется автоматически из themeParams)
  $('btn-theme')?.addEventListener('click', () => {
    const tp = TG()?.themeParams;
    // Если Telegram доступен с реальными themeParams — не даём переключать вручную
    if (tp && typeof tp.bg_color === 'string' && tp.bg_color.length > 0) return;
    state.theme = applyTheme(
      state.theme === 'light' ? 'dark' : 'light',
      true,
      renderMarkers
    );
  });

  // Скрываем кнопку темы если Telegram Mini App с реальными themeParams
  // Проверяем сразу и через задержку (themeParams могут прийти позже)
  const _hideThemeBtnIfNeeded = () => {
    const tp = TG()?.themeParams;
    if (tp && typeof tp.bg_color === 'string' && tp.bg_color.length > 0) {
      const btnTheme = $('btn-theme');
      if (btnTheme) btnTheme.style.display = 'none';
    }
  };
  _hideThemeBtnIfNeeded();
  setTimeout(_hideThemeBtnIfNeeded, 1500);
  setTimeout(_hideThemeBtnIfNeeded, 4000);

  // Аватар → Profile modal
  $('btn-avatar')?.addEventListener('click', () => {
    if (state.user?.id) {
      openProfile(state.user.id);
    } else {
      showToast('Войдите через Telegram для профиля');
    }
  });

  // Profile back button
  $('profile-back-btn')?.addEventListener('click', closeProfile);

  // Profile modal — swipe down to close
  let profSwipeY = 0;
  const profEl = $('profile-modal');
  if (profEl) {
    profEl.addEventListener('touchstart', e => { profSwipeY = e.touches[0].clientY; }, { passive: true });
    profEl.addEventListener('touchend', e => {
      if (e.changedTouches[0].clientY - profSwipeY > 72) closeProfile();
    }, { passive: true });
  }

  // Custom event from profile → open event detail
  document.addEventListener('meow:open-event', e => {
    const evId = e.detail?.eventId;
    if (!evId) return;
    const ev = state.rawAllEvents.map(normalizeEvent).find(x => x.id === evId);
    if (ev) {
      openCard(evId);
      flyTo(ev);
    }
  });

  // Custom event → open user mini card (from looking section, who's going, etc.)
  document.addEventListener('meow:open-user-card', e => {
    const userId = e.detail?.userId;
    if (!userId) return;
    import('./social.js').then(mod => mod.openUserCard(userId));
  });

  // Панель событий
  let panelFilterMode = filterByDate(fmt(new Date())).length ? 'today' : 'all';
  const filterAll   = $('filter-all');
  const filterToday = $('filter-today');

  $('btn-events')?.addEventListener('click', () => {
    const willOpen = !state.panelOpen || state.panelMode !== 'events';
    closePlaceCard();
    setPanel(willOpen, 'events');
    if (willOpen) applyPanelFilter(panelFilterMode);
  });

  $('btn-places')?.addEventListener('click', () => {
    if (state.panelOpen && state.panelMode === 'places') return;
    closeCard();
    setPanel(true, 'places');
  });

  filterAll?.addEventListener('click', () => {
    panelFilterMode = 'all';
    setPanel(true, 'events');
    applyPanelFilter('all');
    filterAll.classList.add('active');
    filterToday?.classList.remove('active');
  });
  filterToday?.addEventListener('click', () => {
    panelFilterMode = 'today';
    setPanel(true, 'events');
    applyPanelFilter('today');
    filterToday.classList.add('active');
    filterAll?.classList.remove('active');
  });
  // Начальное состояние кнопок фильтра
  if (panelFilterMode === 'today') filterToday?.classList.add('active');
  else                              filterAll?.classList.add('active');

  // Карточка
  $('btn-close-card')?.addEventListener('click', closeCard);
  $('btn-close-place-card')?.addEventListener('click', closePlaceCard);

  // Детальный экран — просто закрываем, без history manipulation
  $('btn-detail-back')?.addEventListener('click', () => closeDetail());
  $('btn-place-detail-back')?.addEventListener('click', () => closePlaceDetail());

  // Свайп вниз для закрытия детального экрана события
  let swipeStartY = 0;
  const detailEl = $('event-detail');
  if (detailEl) {
    detailEl.addEventListener('touchstart', e => { swipeStartY = e.touches[0].clientY; }, { passive: true });
    detailEl.addEventListener('touchend',   e => {
      const body = $('detail-body');
      if (body?.scrollTop === 0 && e.changedTouches[0].clientY - swipeStartY > 72) closeDetail();
    }, { passive: true });
  }

  // Свайп вниз для закрытия детального экрана места
  let placeSwipeStartY = 0;
  const placeDetailEl = $('place-detail');
  if (placeDetailEl) {
    placeDetailEl.addEventListener('touchstart', e => { placeSwipeStartY = e.touches[0].clientY; }, { passive: true });
    placeDetailEl.addEventListener('touchend',   e => {
      const body = $('place-detail-body');
      if (body?.scrollTop === 0 && e.changedTouches[0].clientY - placeSwipeStartY > 72) closePlaceDetail();
    }, { passive: true });
  }
  // Popstate больше не управляет деталками, так как мы не используем pushState
  // Оставляем только для закрытия при системной кнопке "Назад" в браузере
  window.addEventListener('popstate', () => {
    // Деталки уже закрыты, ничего не делаем
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

  // Свайп вниз для закрытия карточки места
  let placeCardSwipeStartY = 0;
  const placeCardEl = $('place-card');
  if (placeCardEl) {
    placeCardEl.addEventListener('touchstart', e => { placeCardSwipeStartY = e.touches[0].clientY; }, { passive: true });
    placeCardEl.addEventListener('touchend',   e => {
      if (e.changedTouches[0].clientY - placeCardSwipeStartY > 72) closePlaceCard();
    }, { passive: true });
  }

  // Зум на постер в детальном экране события
  // Разворачиваем только если у мероприятия есть картинка
  $('detail-poster')?.addEventListener('click', e => {
    if (e.target.closest('.detail-back')) return;
    if (!state.detailHasImage) return;
    $('detail-poster').classList.toggle('expanded');
    TG()?.HapticFeedback?.impactOccurred('light');
  });

  // Зум на постер в детальном экране места
  // Разворачиваем только если у места есть картинка
  $('place-detail-poster')?.addEventListener('click', e => {
    if (e.target.closest('.detail-back')) return;
    if (!state.placeDetailHasImage) return;
    $('place-detail-poster').classList.toggle('expanded');
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
      if (state.activePlaceId) closePlaceCard();
      _searchTimer = setTimeout(() => handleSearch(e.target.value.trim()), 300);
    });
    searchInput.addEventListener('focus', () => {
      if (state.panelOpen) setPanel(false);
      closeCard();
      closePlaceCard();
      closeCalendar();
    });
    searchInput.addEventListener('blur', () => setTimeout(hideSuggestions, 200));
  }

  // Закрытие панели по клику вне неё
  const _closePanel = e => {
    if (state.panelOpen && !$('events-panel')?.contains(e.target)
        && e.target !== $('btn-events') && e.target !== $('btn-places')) {
      setPanel(false);
    }
  };
  document.addEventListener('click',      _closePanel);
  document.addEventListener('touchstart', _closePanel);

  // Скрываем подсказки при касании карты
  $('map')?.addEventListener('touchstart', hideSuggestions, { passive: true });

  // Не пропускаем клики сквозь оверлеи
  ['events-panel','event-card','event-detail','place-card','place-detail'].forEach(id => {
    $(id)?.addEventListener('click', e => e.stopPropagation());
  });

  // ── Deep linking: ?place=ID ──────────────────────────
  const placeId = new URLSearchParams(window.location.search).get('place');
  if (placeId) {
    const pl = getPlaceById(placeId);
    if (pl) {
      setTimeout(() => { flyToPlace(pl); openPlaceCard(pl.id); }, 100);
    }
  }

  console.log('[MEOW] Application initialized');
}

// ─── Внутренние обработчики для мест ─────────────────

function _onOpenPlace(id) {
  closeCard();
  const place = getPlaceById(id);
  if (place) flyToPlace(place);
  openPlaceCard(id);
}

function _onOpenEventFromPlace(evId) {
  closePlaceCard();
  closePlaceDetail();
  const ev = state.rawAllEvents.map(normalizeEvent).find(e => e.id === evId);
  if (ev) {
    openCard(evId);
    flyTo(ev);
  }
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