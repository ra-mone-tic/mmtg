/* Meow core module — contains main app logic exported as boot() */

import {
  initMap as mapInit,
  addMarkers,
  clearMarkers,
  setPinActive,
  flyTo,
  getMapInstance,
  addUserMarker,
  clearUserMarker
} from './map-core.js';

// ─── Config ────────────────────────────────────────────
const REGION_BBOX = [19.30, 54.00, 23.10, 55.60];
const REGION_CENTER = [20.50, 54.71];
const REGION_ZOOM = 11.5;

const CFG = {
  MAP_CENTER: REGION_CENTER,
  MAP_ZOOM: REGION_ZOOM,
  FLY_ZOOM: 14.5,
  FLY_OFFSET: [0, 240],
  FLY_MS: 540,
  SHARE_BASE: 'https://t.me/your_bot?start=',
  STYLES: {
    dark:  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  POSTER_GRADS: [
    ['#6652bb','#a87ef0'],['#b84f70','#ee80aa'],
    ['#5070bc','#7ca8f2'],['#4898b8','#74ccee'],
    ['#6ab048','#96e270'],['#b87a40','#eaaa60'],
  ],
  BBOX: REGION_BBOX,
};

// Функция-геттер Telegram WebApp — читает window.Telegram каждый раз
// Это гарантирует что API будет получен даже если он появился с задержкой
const TG = () => window.Telegram?.WebApp ?? null;

// ─── Helpers ───────────────────────────────────────────
const $  = id => document.getElementById(id);
const qs = s  => document.querySelector(s);
const pad = n => String(n).padStart(2,'0');
const fmt = d => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
let dayNames = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

function dayName(str) {
  const [d,m,y] = str.split('.').map(Number);
  const date = new Date(y,m-1,d);
  
  // Сегодня
  const today = new Date();
  today.setHours(0,0,0,0);
  if (+date === +today) return 'Сегодня';
  
  // Завтра
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (+date === +tomorrow) return 'Завтра';
  
  return dayNames[date.getDay()];
}

function posterGrad(id) {
  const g = CFG.POSTER_GRADS;
  const [a,b] = g[id.charCodeAt(id.length-1) % g.length];
  return `linear-gradient(135deg,${a},${b})`;
}

const PIN_ICONS = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const CAL_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const CLK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

function metaHTML(ev) {
  return `<div class="meta-row">${PIN_ICONS}${ev.address}</div>
          <div class="meta-row">${CAL_ICON}${ev.date}</div>
          <div class="meta-row">${CLK_ICON}${ev.time}</div>`;
}

// ─── Toast ─────────────────────────────────────────────
let toastT;
function showToast(msg, pos) {
  let el = qs('.toast');
  if (!el) { el = document.createElement('div'); el.className='toast'; $('app').appendChild(el); }
  el.textContent = msg;
  el.style.bottom = (pos ?? (($('bottom-bar')?.offsetHeight ?? 62) + 20)) + 'px';
  clearTimeout(toastT);
  el.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add('show');
    toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }));
}

// ─── Share ─────────────────────────────────────────────
function legacyCopy(text, cb) {
  const ta = Object.assign(document.createElement('textarea'), {
    value: text, readOnly: true,
    style: 'position:fixed;left:-9999px;opacity:0'
  });
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); cb(); } catch(e) {}
  ta.remove();
}

function shareEvent(ev) {
  const link = CFG.SHARE_BASE + ev.id;
  const webapp = TG();
  const ok = () => {
    webapp?.HapticFeedback?.notificationOccurred('success');
    if (webapp?.showPopup) {
      webapp.showPopup({
        title:   'Ссылка скопирована',
        message: `«${ev.title}» готова к отправке`,
        buttons: [{ type:'ok', text:'Отлично!' }]
      });
    } else {
      showToast('🔗 Ссылка скопирована!');
    }
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(ok).catch(() => legacyCopy(link, ok));
  } else {
    legacyCopy(link, ok);
  }
}

// ─── Theme ─────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('meow-theme');
  const defaultTheme = 'dark';
  applyTheme(saved || defaultTheme, false);
  return saved || defaultTheme;
}

function applyTheme(t, updateMap=true) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('meow-theme', t);
  const ico = $('theme-icon');
  if (ico) {
    if (t === 'dark') {
      ico.innerHTML = `<circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
    } else {
      ico.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
    }
  }
  if (updateMap && getMapInstance()) {
    getMapInstance().once('style.load', renderMarkers);
    getMapInstance().setStyle(CFG.STYLES[t]);
  }
  return t;
}

// ─── Avatar ────────────────────────────────────────────
function initAvatar(retry = 5) {
  const btn = $('btn-avatar');
  const webapp = TG();
  const user = webapp?.initDataUnsafe?.user;
  if (!btn) return;
  if (!user) {
    if (retry > 0) setTimeout(() => initAvatar(retry - 1), 250);
    return;
  }
  if (!user.photo_url) {
    setInitials(btn, user);
    return;
  }
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.onload = () => btn.replaceChildren(img);
  img.onerror = () => setInitials(btn, user);
  img.src = `${user.photo_url}${user.photo_url.includes('?') ? '&' : '?'}t=${Date.now()}`;
}
function setInitials(btn, user) {
  const first = user?.first_name?.[0] ?? '';
  const last = user?.last_name?.[0] ?? '';
  btn.textContent = (first + last).toUpperCase() || 'U';
}

// ─── State ─────────────────────────────────────────────
let map = null, events = [];
let allEvents = [];
let activeId = null, detailId = null;
let panelOpen = false, theme = 'dark';
let currentDate = new Date();

// ─── Data Loading ──────────────────────────────────────
let rawAllEvents = [];

/**
 * Приводит дату к единому формату DD.MM.YYYY (с ведущими нулями).
 */
function normalizeDate(str) {
  if (!str) return str;
  const parts = str.split('.');
  if (parts.length !== 3) return str;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return str;
  return `${pad(d)}.${pad(m)}.${y}`;
}

async function loadAllEvents() {
  try {
    const resp = await fetch('events.json');
    const data = await resp.json();
    // Нормализуем даты у всех событий
    rawAllEvents = data.map(e => ({
      ...e,
      date: normalizeDate(e.date)
    }));
    return rawAllEvents;
  } catch (e) {
    console.error('Ошибка загрузки событий:', e);
    return [];
  }
}

function normalizeEvent(e) {
  return {
    id: e.id,
    title: e.title,
    venue: e.location || e.venue || e.address || '',
    address: e.location || e.address || '',
    date: e.date,
    time: e.time || '',
    desc: e.full_description || e.short_description || '',
    imageUrl: e.imageUrl || null,
    lng: e.lon,
    lat: e.lat,
    contacts: e.contacts || ''
  };
}

function filterByDate(dateStr) {
  return rawAllEvents
    .filter(e => e.date === dateStr)
    .map(normalizeEvent);
}

function parseDate(str) {
  const [d, m, y] = str.split('.').map(Number);
  if (!y) return null;
  return new Date(y, m - 1, d);
}

function findNearestDate() {
  if (!rawAllEvents.length) return null;
  
  // Сортируем даты как объекты Date
  const dates = [...new Set(rawAllEvents.map(e => e.date))]
    .filter(d => parseDate(d) !== null)
    .sort((a, b) => parseDate(a) - parseDate(b));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Ищем ближайшую будущую или сегодняшнюю дату
  for (const d of dates) {
    const eventDate = parseDate(d);
    if (eventDate >= today) return d;
  }
  
  // Если будущих нет, берём последнюю (самую позднюю)
  return dates[dates.length - 1] || null;
}

// ─── Data ──────────────────────────────────────────────
async function fetchEvents(dateStr) {
  try {
    events = filterByDate(dateStr);
    allEvents = events;
  } catch(e) {
    events=[];
    console.error('[MEOW]',e);
  }
  if (getMapInstance()?.loaded()) renderMarkers();
  renderList();
}

// ─── Integration hooks ─────────────────────────────────
async function onEventContacts(ev) {
  TG()?.HapticFeedback?.impactOccurred('light');
  if (ev.contacts && ev.contacts.startsWith('http')) {
    window.open(ev.contacts, '_blank');
  } else {
    showToast('Контакты недоступны');
  }
}
function onSearch(q) {
  if (!q || q.trim() === '') { renderList(); return; }
  const query = q.toLowerCase().trim();
  const filtered = events.filter(ev =>
    ev.title.toLowerCase().includes(query) ||
    ev.venue.toLowerCase().includes(query) ||
    ev.address.toLowerCase().includes(query) ||
    ev.desc.toLowerCase().includes(query)
  );
  renderList(filtered);
}
function onAvatarTap() {
  const webapp = TG();
  const user = webapp?.initDataUnsafe?.user;
  if (!user) return;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  if (webapp?.showPopup) {
    webapp.showPopup({
      title: 'Профиль',
      message: name || 'Пользователь',
      buttons: [{ type: 'close', text: 'Закрыть' }]
    });
  } else {
    showToast(name || '👤 Пользователь');
  }
}

// ─── Date handling ─────────────────────────────────────
async function onDateChange(dateStr) {
  const dateLabel = $('date-label');
  if (dateLabel) dateLabel.textContent = dateStr;
  const [day, month, year] = dateStr.split('.').map(Number);
  currentDate = new Date(year, month - 1, day);
  await fetchEvents(dateStr);
}

// ─── Map ───────────────────────────────────────────────
function handleMapReady() {
  const loading = $('loading');
  if (loading) loading.classList.add('gone');
  renderMarkers();
}
function handleMapClick() {
  closeCard();
}
function renderMarkers(eventList) {
  const eventsToRender = eventList || events;
  clearMarkers();
  addMarkers(eventsToRender, ev => {
    openCard(ev.id);
    flyTo(ev);
  });
  if (activeId) setPinActive(activeId, true);
}

// ─── Card & Detail ─────────────────────────────────────
function openCard(id) {
  const ev = events.find(e=>e.id===id);
  if (!ev) return;
  if (activeId && activeId!==id) setPinActive(activeId, false);
  activeId = id; setPinActive(id, true);

  const cardVenue = $('card-venue');
  const cardTitle = $('card-title');
  const cardDesc = $('card-desc');
  const cardMeta = $('card-meta');

  if (cardVenue) cardVenue.textContent = ev.venue;
  if (cardTitle) cardTitle.textContent = ev.title;
  if (cardDesc) cardDesc.textContent  = ev.desc;
  if (cardMeta) cardMeta.innerHTML    = metaHTML(ev);

  const btnLearnMore = $('btn-learn-more');
  const btnShare = $('btn-share');
  if (btnLearnMore) btnLearnMore.onclick = () => openDetail(id);
  if (btnShare) btnShare.onclick = () => shareEvent(ev);

  const card = $('event-card');
  if (card) {
    card.classList.add('open');
    card.setAttribute('aria-hidden','false');
  }
  shiftControls(true);
  syncActive(id);
}

function closeCard() {
  if (!activeId) return;
  setPinActive(activeId, false);
  activeId = null;
  const card = $('event-card');
  if (card) {
    card.classList.remove('open');
    card.setAttribute('aria-hidden','true');
  }
  shiftControls(false);
  syncActive(null);
}

function ctrlBase() {
  return ($('bottom-bar')?.offsetHeight ?? 62) + 12;
}

function shiftControls(cardOpen) {
  const ctrl = $('map-controls');
  if (!ctrl) return;
  if (cardOpen) {
    const cardHeight = $('event-card')?.offsetHeight ?? 0;
    ctrl.style.bottom = (ctrlBase() + cardHeight + 12) + 'px';
  } else {
    ctrl.style.bottom = ctrlBase() + 'px';
  }
}

if ($('event-card')) {
  new ResizeObserver(()=>{ if (activeId) shiftControls(true); }).observe($('event-card'));
}

function openDetail(id) {
  const ev = events.find(e=>e.id===id);
  if (!ev) return;
  detailId = id;

  const poster = $('detail-poster');
  if (poster) poster.style.background = posterGrad(ev.id);

  const posterInner = $('poster-inner');
  if (posterInner) {
    const imageUrl = ev.imageUrl && ev.imageUrl.trim() ? ev.imageUrl : null;
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = ev.title;
      img.onerror = () => {
        posterInner.innerHTML = `<span class="poster-initial">${ev.title?.[0] || '🎭'}</span>`;
      };
      posterInner.innerHTML = '';
      posterInner.appendChild(img);
    } else {
      posterInner.innerHTML = `<span class="poster-initial">${ev.title?.[0] || '🎭'}</span>`;
    }
  }

  const detailVenue = $('detail-venue');
  if (detailVenue) detailVenue.textContent = ev.venue;

  const detailTitle = $('detail-title');
  if (detailTitle) detailTitle.textContent = ev.title;

  const detailMeta = $('detail-meta');
  if (detailMeta) detailMeta.innerHTML = metaHTML(ev).replace(/13px/g,'13.5px');

  const detailDesc = $('detail-desc');
  if (detailDesc) detailDesc.textContent = ev.desc;

  const btnContacts = $('btn-contacts');
  const btnDetailShare = $('btn-detail-share');
  if (btnContacts) btnContacts.onclick = () => onEventContacts(ev);
  if (btnDetailShare) btnDetailShare.onclick = () => shareEvent(ev);

  const modal = $('event-detail');
  if (modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  }

  const detailBody = $('detail-body');
  if (detailBody) detailBody.scrollTop = 0;

  TG()?.HapticFeedback?.selectionChanged();
  history.pushState({meowDetail:true},'');
}

function closeDetail() {
  const modal = $('event-detail');
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  }
  detailId = null;
  TG()?.HapticFeedback?.impactOccurred('light');
}

let swipeY = 0;
const detailEl = $('event-detail');
if (detailEl) {
  detailEl.addEventListener('touchstart', e=>{swipeY=e.touches[0].clientY;},{passive:true});
  detailEl.addEventListener('touchend', e=>{
    const detailBody = $('detail-body');
    if (detailBody && detailBody.scrollTop===0 && e.changedTouches[0].clientY-swipeY>72) closeDetail();
  },{passive:true});
}

window.addEventListener('popstate', ()=>{
  const modal = $('event-detail');
  if (modal && modal.classList.contains('open')) closeDetail();
});

// ─── Events list ───────────────────────────────────────
function renderList(eventList) {
  const list = $('events-list');
  if (!list) return;
  list.innerHTML='';

  const eventsToRender = eventList || events;

  if (!eventsToRender.length) {
    list.innerHTML='<p style="padding:16px;text-align:center;font-size:13px;color:var(--c-t2)">Событий нет</p>';
    return;
  }

  const groups = eventsToRender.reduce((a,e)=>{ (a[e.date]??=[]).push(e); return a; },{});
  for (const [date,evs] of Object.entries(groups)) {
    const lbl = Object.assign(document.createElement('div'),{className:'day-label',textContent:dayName(date).toUpperCase()});
    list.appendChild(lbl);
    evs.forEach(ev=>{
      const item = document.createElement('div');
      item.className='event-item'+(ev.id===activeId?' active':'');
      item.setAttribute('role','listitem');
      item.setAttribute('data-id',ev.id);
      item.setAttribute('tabindex','0');
      item.innerHTML=`<div class="event-item-title">${ev.title}</div><div class="event-item-sub">${ev.venue} · ${ev.time}</div>`;
      const go = () => {
        if (ev.date !== fmt(currentDate)) {
          closeCard();
          onDateChange(ev.date).then(() => {
            flyTo(ev);
            openCard(ev.id);
            setPanel(false);
          });
        } else {
          flyTo(ev);
          openCard(ev.id);
          setPanel(false);
        }
      };
      item.addEventListener('click',go);
      item.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
      list.appendChild(item);
    });
  }
}

function syncActive(id) {
  document.querySelectorAll('.event-item').forEach(el=>el.classList.toggle('active',el.getAttribute('data-id')===id));
}

function setPanel(open) {
  panelOpen = open;
  const panel = $('events-panel');
  const btnEvents = $('btn-events');
  if (panel) {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
  }
  if (btnEvents) {
    btnEvents.classList.toggle('active', open);
    btnEvents.setAttribute('aria-expanded', String(open));
  }
}

// ─── Boot sequence ─────────────────────────────────────
export async function boot() {
  // Initialize Telegram WebApp first
  const webapp = TG();
  webapp?.ready();
  webapp?.expand();

  // Initialize theme
  theme = initTheme();
  requestAnimationFrame(() => { applyTheme(theme, false); });

  // Initialize avatar
  initAvatar();

  // Load all events first to find nearest date
  await loadAllEvents();

  // Find nearest date with events
  const nearestDate = findNearestDate();
  if (nearestDate) {
    currentDate = new Date();
    const [day, month, year] = nearestDate.split('.').map(Number);
    currentDate = new Date(year, month - 1, day);
  }

  // Set initial date label
  const dateLabel = $('date-label');
  if (dateLabel) dateLabel.textContent = fmt(currentDate);

  // Initialize map
  mapInit({
    theme,
    center: CFG.MAP_CENTER,
    zoom: CFG.MAP_ZOOM,
    bbox: CFG.BBOX,
    onMapReady: handleMapReady,
    onMapClick: handleMapClick
  });

  // Adjust controls position
  requestAnimationFrame(()=>requestAnimationFrame(()=>shiftControls(false)));

  // Load events for the nearest date
  await fetchEvents(fmt(currentDate));

  // ─── Listeners ─────────────────────────────────────────
  const btnTheme = $('btn-theme');
  if (btnTheme) btnTheme.addEventListener('click', ()=>{ theme = applyTheme(theme==='light'?'dark':'light'); });

  const btnAvatar = $('btn-avatar');
  if (btnAvatar) btnAvatar.addEventListener('click', onAvatarTap);

  const btnEvents = $('btn-events');
  if (btnEvents) btnEvents.addEventListener('click', ()=>{
    const willOpen = !panelOpen;
    setPanel(willOpen);
    if (willOpen) applyPanelFilter();
  });

  // Filter buttons in panel-head
  const filterAll = $('filter-all');
  const filterToday = $('filter-today');
  let panelFilterMode = 'all'; // 'all' | 'today'

  function applyPanelFilter() {
    if (panelFilterMode === 'today') {
      const todayStr = fmt(new Date());
      const filtered = filterByDate(todayStr);
      renderList(filtered);
    } else {
      const allDates = [...new Set(rawAllEvents.map(e => e.date))]
        .filter(d => parseDate(d) !== null)
        .sort((a, b) => parseDate(a) - parseDate(b));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = allDates.filter(d => {
        const dt = parseDate(d);
        return dt >= today;
      });

      let result = [];
      upcoming.forEach(d => {
        const dayEvents = filterByDate(d);
        result = result.concat(dayEvents);
      });
      renderList(result);
    }
  }

  // Определяем режим по умолчанию: если есть события на сегодня — "Сегодня", иначе "Все"
  const todayStr = fmt(new Date());
  const hasTodayEvents = filterByDate(todayStr).length > 0;
  panelFilterMode = hasTodayEvents ? 'today' : 'all';

  if (filterAll) {
    filterAll.addEventListener('click', () => {
      panelFilterMode = 'all';
      applyPanelFilter();
      filterAll.classList.add('active');
      if (filterToday) filterToday.classList.remove('active');
    });
  }
  if (filterToday) {
    filterToday.addEventListener('click', () => {
      panelFilterMode = 'today';
      applyPanelFilter();
      filterToday.classList.add('active');
      if (filterAll) filterAll.classList.remove('active');
    });
  }
  if (hasTodayEvents && filterToday) {
    filterToday.classList.add('active');
  } else if (filterAll) {
    filterAll.classList.add('active');
  }

  const btnCloseCard = $('btn-close-card');
  if (btnCloseCard) btnCloseCard.addEventListener('click', closeCard);

  const btnDetailBack = $('btn-detail-back');
  if (btnDetailBack) btnDetailBack.addEventListener('click', ()=>{ if(history.state?.meowDetail) history.back(); else closeDetail(); });

  const btnDate = $('btn-date');
  if (btnDate) {
    btnDate.addEventListener('click', (e) => {
      e.stopPropagation();
      openCalendar();
    });
  }

  // ─── Calendar ─────────────────────────────────────────
  let calViewDate = new Date();
  
  function openCalendar() {
    calViewDate = new Date(currentDate);
    renderCalendar();
    const modal = $('calendar-modal');
    if (modal) {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }
    setPanel(false);
  }
  
  function closeCalendar() {
    const modal = $('calendar-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  }
  
  function renderCalendar() {
    const grid = $('cal-grid');
    const monthEl = $('cal-month');
    if (!grid || !monthEl) return;
    
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                        'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    monthEl.textContent = `${monthNames[month]} ${year}`;
    
    grid.innerHTML = '';
    
    const dw = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
    dw.forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dw';
      el.textContent = d;
      grid.appendChild(el);
    });
    
    const eventDates = new Set();
    if (rawAllEvents.length) {
      rawAllEvents.forEach(e => {
        if (e.date) eventDates.add(e.date);
      });
    }
    
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7;
    
    for (let i = 0; i < startDow; i++) {
      const el = document.createElement('div');
      grid.appendChild(el);
    }
    
    const todayStr = fmt(new Date());
    const activeStr = fmt(currentDate);
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${pad(d)}.${pad(month + 1)}.${year}`;
      const el = document.createElement('div');
      el.className = 'cal-day';
      el.textContent = d;
      
      if (dateStr === todayStr) el.classList.add('today');
      if (dateStr === activeStr) el.classList.add('active');
      if (eventDates.has(dateStr)) el.classList.add('has-events');
      
      el.addEventListener('click', async () => {
        const [day, m, y] = dateStr.split('.').map(Number);
        currentDate = new Date(y, m - 1, day);
        await onDateChange(dateStr);
        closeCalendar();
      });
      
      grid.appendChild(el);
    }
  }
  
  const calPrev = $('cal-prev');
  const calNext = $('cal-next');
  if (calPrev) calPrev.addEventListener('click', () => { calViewDate.setMonth(calViewDate.getMonth() - 1); renderCalendar(); });
  if (calNext) calNext.addEventListener('click', () => { calViewDate.setMonth(calViewDate.getMonth() + 1); renderCalendar(); });
  
  const calOverlay = $('cal-overlay');
  if (calOverlay) calOverlay.addEventListener('click', closeCalendar);
  
  // ─── Search suggestions ────────────────────────────────
  function showSearchSuggestions(results) {
    const el = $('search-suggestions');
    if (!el) return;
    if (!results || !results.length) {
      hideSearchSuggestions();
      return;
    }
    el.innerHTML = results.slice(0, 5).map(ev => `
      <div class="sug-item" data-id="${ev.id}">
        <div class="sug-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div>
          <div class="sug-text">${ev.title}</div>
          <div class="sug-sub">${ev.venue} · ${ev.time || ev.date}</div>
        </div>
      </div>
    `).join('');
    el.querySelectorAll('.sug-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        // Ищем событие во всех данных, а не только в текущей дате
        const allNormalized = rawAllEvents.map(normalizeEvent);
        const ev = allNormalized.find(e => e.id === id);
        if (ev) {
          if (ev.date !== fmt(currentDate)) {
            closeCard();
            await onDateChange(ev.date);
          }
          flyTo(ev);
          openCard(id);
        }
        hideSearchSuggestions();
        const inp = $('search-input');
        if (inp) inp.value = '';
      });
    });
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
  }
  
  function hideSearchSuggestions() {
    const el = $('search-suggestions');
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
  }
  
  onSearch = function(q) {
    if (!q || q.trim() === '') { hideSearchSuggestions(); return; }
    const query = q.toLowerCase().trim();
    const results = rawAllEvents
      .map(normalizeEvent)
      .filter(ev =>
        ev.title.toLowerCase().includes(query) ||
        ev.venue.toLowerCase().includes(query) ||
        ev.address.toLowerCase().includes(query) ||
        ev.desc.toLowerCase().includes(query)
      );
    showSearchSuggestions(results);
  };
  
  // Map controls
  const btnZoomIn = $('btn-zoom-in');
  if (btnZoomIn) btnZoomIn.addEventListener('click', ()=>getMapInstance()?.zoomIn({duration:270}));

  const btnZoomOut = $('btn-zoom-out');
  if (btnZoomOut) btnZoomOut.addEventListener('click', ()=>getMapInstance()?.zoomOut({duration:270}));

  const btnLocate = $('btn-locate');
  if (btnLocate) btnLocate.addEventListener('click', ()=>{
    if (!navigator.geolocation) return;
    TG()?.HapticFeedback?.impactOccurred('medium');
    navigator.geolocation.getCurrentPosition(
      ({coords})=>{
        addUserMarker(coords.longitude, coords.latitude);
        getMapInstance()?.flyTo({center:[coords.longitude,coords.latitude],zoom:14.5,duration:700});
      },
      err=>console.warn('[MEOW] geo:',err.message)
    );
  });

  // Search
  let searchT;
  const searchInput = $('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e=>{
      clearTimeout(searchT);
      searchT=setTimeout(()=>onSearch(e.target.value.trim()),300);
    });
    searchInput.addEventListener('focus', ()=>{
      if (panelOpen) setPanel(false);
      closeCard();
      closeCalendar();
    });
  }

  // Close panel on outside click/touch
  document.addEventListener('click', e => {
    const panel = $('events-panel');
    const btnEvents = $('btn-events');
    if (panelOpen && panel && !panel.contains(e.target) && btnEvents !== e.target) {
      setPanel(false);
    }
  });
  document.addEventListener('touchstart', e => {
    if (panelOpen) {
      const panel = $('events-panel');
      const btnEvents = $('btn-events');
      if (panel && !panel.contains(e.target) && btnEvents !== e.target) {
        setPanel(false);
      }
    }
  });
  const mapEl = $('map');
  if (mapEl) {
    mapEl.addEventListener('touchstart', hideSearchSuggestions, {passive:true});
  }

  // Hide suggestions on blur
  if (searchInput) {
    searchInput.addEventListener('blur', () => setTimeout(hideSearchSuggestions, 200));
  }

  // Prevent event propagation from panels
  ['events-panel','event-card','event-detail'].forEach(id=>{
    const el = $(id);
    if (el) el.addEventListener('click', e=>e.stopPropagation());
  });

  console.log('[MEOW] Application initialized');
}