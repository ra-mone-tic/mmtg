// ─── Calendar ────────────────────────────────────────
import { $, pad, fmt } from './helpers.js';
import { state } from './state.js';
import { parseDate } from './data.js';
import { setPanel } from './events-list.js';

let _onDateChange = null;
let _calViewDate  = new Date();

const MONTH_NAMES = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
];

export function initCalendar({ onDateChange }) {
  _onDateChange = onDateChange;

  const calPrev    = $('cal-prev');
  const calNext    = $('cal-next');
  const calOverlay = $('cal-overlay');

  calPrev?.addEventListener('click',    () => { _calViewDate.setMonth(_calViewDate.getMonth() - 1); _render(); });
  calNext?.addEventListener('click',    () => { _calViewDate.setMonth(_calViewDate.getMonth() + 1); _render(); });
  calOverlay?.addEventListener('click', closeCalendar);
}

export function openCalendar() {
  _calViewDate = new Date();
  _render();
  const modal = $('calendar-modal');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  setPanel(false);
}

export function closeCalendar() {
  const modal = $('calendar-modal');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
}

function _render() {
  const grid    = $('cal-grid');
  const monthEl = $('cal-month');
  if (!grid || !monthEl) return;

  const year  = _calViewDate.getFullYear();
  const month = _calViewDate.getMonth();
  monthEl.textContent = `${MONTH_NAMES[month]} ${year}`;
  grid.innerHTML = '';

  // Заголовки дней недели
  ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dw'; el.textContent = d;
    grid.appendChild(el);
  });

  const eventDates = new Set(state.rawAllEvents.map(e => e.date).filter(Boolean));
  const startDow   = (new Date(year, month, 1).getDay() + 6) % 7; // пн=0
  for (let i = 0; i < startDow; i++) grid.appendChild(document.createElement('div'));

  const todayStr  = fmt(new Date());
  const activeStr = fmt(state.currentDate);

  for (let d = 1, days = new Date(year, month + 1, 0).getDate(); d <= days; d++) {
    const dateStr = `${pad(d)}.${pad(month + 1)}.${year}`;
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    if (dateStr === todayStr)           el.classList.add('today');
    if (dateStr === activeStr)          el.classList.add('active');
    if (eventDates.has(dateStr))        el.classList.add('has-events');
    el.addEventListener('click', async () => {
      const [day, m, y] = dateStr.split('.').map(Number);
      state.currentDate = new Date(y, m - 1, day);
      await _onDateChange?.(dateStr);
      closeCalendar();
    });
    grid.appendChild(el);
  }
}
