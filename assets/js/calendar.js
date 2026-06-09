// \u2500\u2500\u2500 Calendar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
import { $, pad, fmt, showBackButton, hideBackButton } from './helpers.js';
import { state } from './state.js';
import { parseDate } from './data.js';
import { setPanel } from './events-list.js';
import { showToast } from './toast.js';
import { closeCard } from './card.js';

let _onDateChange = null;
let _calViewDate  = new Date();
let _multiSet     = null;   // Set<string> \u0432 \u0440\u0435\u0436\u0438\u043c\u0435 multi-select

const MONTH_NAMES = [
  '\u042f\u043d\u0432\u0430\u0440\u044c','\u0424\u0435\u0432\u0440\u0430\u043b\u044c','\u041c\u0430\u0440\u0442','\u0410\u043f\u0440\u0435\u043b\u044c','\u041c\u0430\u0439','\u0418\u044e\u043d\u044c',
  '\u0418\u044e\u043b\u044c','\u0410\u0432\u0433\u0443\u0441\u0442','\u0421\u0435\u043d\u0442\u044f\u0431\u0440\u044c','\u041e\u043a\u0442\u044f\u0431\u0440\u044c','\u041d\u043e\u044f\u0431\u0440\u044c','\u0414\u0435\u043a\u0430\u0431\u0440\u044c',
];

export function initCalendar({ onDateChange }) {
  _onDateChange = onDateChange;

  const calPrev    = $('cal-prev');
  const calNext    = $('cal-next');
  const calOverlay = $('cal-overlay');
  const calMulti   = $('cal-multi');
  const calToday   = $('cal-today');

  calPrev?.addEventListener('click',    () => { _calViewDate.setMonth(_calViewDate.getMonth() - 1); _render(); });
  calNext?.addEventListener('click',    () => { _calViewDate.setMonth(_calViewDate.getMonth() + 1); _render(); });
  calOverlay?.addEventListener('click', closeCalendar);

  // \u041a\u043d\u043e\u043f\u043a\u0430 "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e" \u2192 "\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c"
  calMulti?.addEventListener('click', () => {
    if (state.multiSelect) {
      _applyMulti();
    } else {
      // \u0412\u0445\u043e\u0434\u0438\u043c \u0432 \u0440\u0435\u0436\u0438\u043c multi-select.
      // \u041f\u0440\u0435\u0434\u0437\u0430\u043f\u043e\u043b\u043d\u044f\u0435\u043c \u0432\u044b\u0431\u043e\u0440 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0434\u0430\u0442\u043e\u0439.
      _multiSet = new Set([fmt(state.currentDate)]);
      state.multiSelect = true;
      state.selectedDates = [..._multiSet];
      _render();
    }
  });

  // \u041a\u043d\u043e\u043f\u043a\u0430 "\u0421\u0435\u0433\u043e\u0434\u043d\u044f"
  calToday?.addEventListener('click', () => {
    const todayStr = fmt(new Date());
    if (state.multiSelect) {
      _multiSet.add(todayStr);
      state.selectedDates = [..._multiSet];
      _applyMulti();
    } else {
      const [d, m, y] = todayStr.split('.').map(Number);
      state.currentDate = new Date(y, m - 1, d);
      _calViewDate = new Date(state.currentDate);
      closeCard();
      _onDateChange?.(todayStr);
      closeCalendar();
    }
  });
}

export function openCalendar() {
  _calViewDate = new Date();
  // Если мы в multi-select — восстанавливаем выбор
  if (state.multiSelect && state.selectedDates.length) {
    _multiSet = new Set(state.selectedDates);
  } else {
    state.multiSelect = false;
    state.selectedDates = [];
    _multiSet = null;
  }
  _render();
  const modal = $('calendar-modal');
  if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
  showBackButton();
  setPanel(false);
  // Свайпы для календаря
  _initSwipe();
}

export function closeCalendar() {
  // \u041f\u0440\u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u0438 \u0431\u0435\u0437 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f \u2014 \u0441\u0431\u0440\u0430\u0441\u044b\u0432\u0430\u0435\u043c multi \u0440\u0435\u0436\u0438\u043c
  if (state.multiSelect) {
    state.multiSelect = false;
    state.selectedDates = [];
    _multiSet = null;
  }
  const modal = $('calendar-modal');
  if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
  hideBackButton();
}

function _applyMulti() {
  if (!_multiSet || _multiSet.size < 2) {
    showToast('\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0435\u0449\u0451 \u043e\u0434\u043d\u0443 \u0434\u0430\u0442\u0443');
    return;
  }
  // \u0421\u043e\u0440\u0442\u0438\u0440\u0443\u0435\u043c \u043f\u043e \u0432\u043e\u0437\u0440\u0430\u0441\u0442\u0430\u043d\u0438\u044e
  const dates = [..._multiSet].sort((a, b) => parseDate(a) - parseDate(b));
  state.selectedDates = dates;
  state.multiSelect = true;
  // \u0424\u043e\u0440\u043c\u0438\u0440\u0443\u0435\u043c \u043b\u0435\u0439\u0431\u043b \u0434\u043b\u044f dateLabel: \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d
  const label = _formatRangeLabel(dates);
  const dateLabel = $('date-label');
  if (dateLabel) dateLabel.textContent = label;
  // \u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c currentDate \u043a\u0430\u043a \u043f\u0435\u0440\u0432\u0443\u044e \u0434\u0430\u0442\u0443 (\u0434\u043b\u044f \u043f\u0440\u043e\u0447\u0438\u0445 \u043c\u043e\u0434\u0443\u043b\u0435\u0439)
  const [d, m, y] = dates[0].split('.').map(Number);
  state.currentDate = new Date(y, m - 1, d);
  // \u0421\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u043e onDateChange \u0432 \u0440\u0435\u0436\u0438\u043c\u0435 multi \u043d\u0435 \u0432\u044b\u0437\u044b\u0432\u0430\u0435\u043c, \u0442.\u043a. \u0432 fetchEvents \u043e\u043d \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 filterByDate(dateStr)
  // \u0412\u043c\u0435\u0441\u0442\u043e \u044d\u0442\u043e\u0433\u043e \u0432\u044b\u0437\u044b\u0432\u0430\u0435\u043c \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u044c\u043d\u044b\u0439 \u043a\u043e\u043b\u043b\u0431\u044d\u043a
  closeCard();
  if (typeof _onMultiApply === 'function') _onMultiApply(dates);
  closeCalendar();
}

let _onMultiApply = null;
export function setMultiApplyHandler(fn) { _onMultiApply = fn; }

function _formatRangeLabel(dates) {
  if (dates.length === 1) return dates[0];
  const [d1, m1, y1] = dates[0].split('.').map(Number);
  const [d2, m2, y2] = dates.at(-1).split('.').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dt1 = new Date(y1, m1 - 1, d1);
  if (dates.length === 2) {
    if (+dt1 === +today) return '\u0421\u0435\u0433\u043e\u0434\u043d\u044f + 1';
    return `${dates[0]}\u2013${dates[1]}`;
  }
  if (+dt1 === +today) return `\u0421\u0435\u0433\u043e\u0434\u043d\u044f + ${dates.length - 1}`;
  return `${dates[0]}\u2026${dates.at(-1)} (${dates.length})`;
}

// ─── Свайпы для календаря ──────────────────────────

let _swipeCal = { startX: 0, startY: 0 };

function _initSwipe() {
  const calSheet = $('cal-sheet');
  if (!calSheet) return;
  calSheet.addEventListener('touchstart', e => {
    _swipeCal.startX = e.touches[0].clientX;
    _swipeCal.startY = e.touches[0].clientY;
  }, { passive: true });
  calSheet.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _swipeCal.startX;
    const dy = e.changedTouches[0].clientY - _swipeCal.startY;
    // Горизонтальный свайп (влево/вправо) — смена месяца
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0) {
        // Свайп вправо — предыдущий месяц
        _calViewDate.setMonth(_calViewDate.getMonth() - 1);
      } else {
        // Свайп влево — следующий месяц
        _calViewDate.setMonth(_calViewDate.getMonth() + 1);
      }
      _render();
      return;
    }
    // Вертикальный свайп вниз — закрыть календарь
    if (dy > 72) {
      closeCalendar();
    }
  }, { passive: true });
}

function _render() {
  const grid    = $('cal-grid');
  const monthEl = $('cal-month');
  const btnMulti = $('cal-multi');
  const btnToday = $('cal-today');
  if (!grid || !monthEl) return;

  const year  = _calViewDate.getFullYear();
  const month = _calViewDate.getMonth();
  monthEl.textContent = `${MONTH_NAMES[month]} ${year}`;
  grid.innerHTML = '';

  // \u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043a\u0438 \u0434\u043d\u0435\u0439 \u043d\u0435\u0434\u0435\u043b\u0438
  ['\u041f\u041d','\u0412\u0422','\u0421\u0420','\u0427\u0422','\u041f\u0422','\u0421\u0411','\u0412\u0421'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dw'; el.textContent = d;
    grid.appendChild(el);
  });

  const eventDates = new Set(state.rawAllEvents.map(e => e.date).filter(Boolean));
  const startDow   = (new Date(year, month, 1).getDay() + 6) % 7; // \u043f\u043d=0
  for (let i = 0; i < startDow; i++) grid.appendChild(document.createElement('div'));

  const todayStr  = fmt(new Date());
  const activeStr = fmt(state.currentDate);

  for (let d = 1, days = new Date(year, month + 1, 0).getDate(); d <= days; d++) {
    const dateStr = `${pad(d)}.${pad(month + 1)}.${year}`;
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    if (dateStr === todayStr)           el.classList.add('today');
    if (!state.multiSelect && dateStr === activeStr) el.classList.add('active');
    if (state.multiSelect && _multiSet?.has(dateStr)) el.classList.add('multi-selected');
    if (eventDates.has(dateStr))        el.classList.add('has-events');
    el.addEventListener('click', async () => {
      if (state.multiSelect) {
        // \u0422\u043e\u0433\u0433\u043b \u0434\u0430\u0442\u044b
        if (_multiSet.has(dateStr)) {
          if (_multiSet.size === 1) {
            showToast('\u0414\u043e\u043b\u0436\u0435\u043d \u043e\u0441\u0442\u0430\u0442\u044c\u0441\u044f \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u0438\u043d \u0434\u0435\u043d\u044c');
            return;
          }
          _multiSet.delete(dateStr);
        } else {
          _multiSet.add(dateStr);
        }
        state.selectedDates = [..._multiSet];
        _render();
        return;
      }
      // \u041e\u0434\u0438\u043d\u043e\u0447\u043d\u044b\u0439 \u0432\u044b\u0431\u043e\u0440
      const [day, m, y] = dateStr.split('.').map(Number);
      state.currentDate = new Date(y, m - 1, day);
      closeCard();
      await _onDateChange?.(dateStr);
      closeCalendar();
    });
    grid.appendChild(el);
  }

  // \u041e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u043c \u043a\u043d\u043e\u043f\u043a\u0438
  if (btnMulti) {
    if (state.multiSelect) {
      btnMulti.textContent = '\u041f\u0440\u0438\u043c\u0435\u043d\u0438\u0442\u044c';
      btnMulti.classList.add('btn-solid');
      btnMulti.classList.remove('btn-outline');
      const ready = _multiSet && _multiSet.size > 1;
      btnMulti.disabled = !ready;
      btnMulti.classList.toggle('is-ready', !!ready);
    } else {
      btnMulti.textContent = '\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e';
      btnMulti.classList.remove('btn-solid', 'is-ready');
      btnMulti.classList.add('btn-outline');
      btnMulti.disabled = false;
    }
  }
  if (btnToday) {
    btnToday.classList.add('btn-outline');
    btnToday.classList.remove('btn-solid');
  }
}
