// Helpers & UI utilities
import { CFG } from './config.js';
import { state } from './state.js';

export const $  = id => document.getElementById(id);
export const qs = s  => document.querySelector(s);

export const pad = n => String(n).padStart(2, '0');
export const fmt = d => `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;

export const TG = () => window.Telegram?.WebApp ?? null;

const DAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function dayName(str) {
  const [d, m, y] = str.split('.').map(Number);
  const date  = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (+date === +today) return 'Сегодня';
  if (+date === +today) return 'Сегодня';
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (+date === +tomorrow) return 'Завтра';
  return DAY_NAMES[date.getDay()];
}

export function posterGrad(id) {
  const g = CFG.POSTER_GRADS;
  const [a, b] = g[id.charCodeAt(id.length - 1) % g.length];
  return `linear-gradient(135deg,${a},${b})`;
}

export const ICONS = {
  PIN: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  CAL: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  CLK: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
};

/**
 * Форматирует даты для отображения с учётом многодневных событий.
 * Для multiDayGroupId собирает все даты группы и отображает:
 * - 1 дата: "Сегодня" / "01.06.2026"
 * - Непрерывный период: "дд.мм–дд.мм" (напр. "01.06–05.06")
 * - Разрозненные даты: "дд.мм, дд.мм, дд.мм" (через запятую)
 */
function _collectGroupDates(ev) {
  if (!ev.multiDayGroupId) return [ev.date];

  return [...new Set(
    state.rawAllEvents
      .filter(e => e.multi_day_group_id === ev.multiDayGroupId && e.date)
      .map(e => e.date)
      .sort()
  )];
}

export function formatEventDates(ev) {
  const single = ev.date === fmt(new Date()) ? 'Сегодня' : ev.date;
  const groupDates = _collectGroupDates(ev);
  if (groupDates.length <= 1) return single;

  // Убираем год из отображения для краткости
  const fmtDate = (d) => {
    const [day, month] = d.split('.');
    return `${day}.${month}`;
  };

  // Проверяем, образуют ли даты непрерывный период
  const _parse = (d) => {
    const [day, month, year] = d.split('.').map(Number);
    return new Date(year, month - 1, day);
  };

  const isContinuous = groupDates.every((d, i) => {
    if (i === 0) return true;
    const prev = _parse(groupDates[i - 1]);
    const curr = _parse(d);
    return (curr - prev) / (1000 * 60 * 60 * 24) === 1;
  });

  if (isContinuous) {
    // Период: дд.мм–дд.мм
    return `${fmtDate(groupDates[0])}–${fmtDate(groupDates[groupDates.length - 1])}`;
  }

  // Разрозненные даты: дд.мм, дд.мм, дд.мм
  return groupDates.map(d => fmtDate(d)).join(', ');
}

/**
 * Мета-строки. Скрывает адрес/время если пусты.
 */
export function metaHTML(ev, showAddress = true) {
  const dateDisplay = formatEventDates(ev);
  const addrRow = showAddress && ev.address
    ? `<div class="meta-row">${ICONS.PIN}${ev.address}</div>`
    : '';
  const timeRow = ev.time
    ? `<div class="meta-row">${ICONS.CLK}${ev.time}</div>`
    : '';
  return `${addrRow}
          <div class="meta-row">${ICONS.CAL}${dateDisplay}</div>
          ${timeRow}`;
}

const ESC_MAP = {
  '&': 'amp;',
  '<': 'lt;',
  '>': 'gt;',
  '"': 'quot;',
  "'": '#39;',
};

function _escape(s) {
  return String(s).replace(/[&<>"']/g, ch => ESC_MAP[ch]);
}

/**
 * Рендерит blocks (параграфы) в HTML.
 */
export function blocksHTML(ev) {
  if (Array.isArray(ev.blocks) && ev.blocks.length) {
    return ev.blocks
      .map(blk => {
        const lines = Array.isArray(blk) ? blk : [String(blk)];
        return `<p>${lines.map(_escape).join("<br>")}</p>`;
      })
      .join('');
  }
  // Fallback: делим сплошной текст на параграфы по \n\n
  return _escape(ev.desc || '')
    .split(/\n\n+/)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join('');
}

/**
 * Рендерит blocks в inline-HTML (без <p>).
 * Используется в мини-карточке, где -webkit-line-clamp работает
 * только с инлайновым содержимым (WebKit/iOS).
 */
export function cardDescHTML(ev) {
  if (Array.isArray(ev.blocks) && ev.blocks.length) {
    return ev.blocks
      .map(blk => {
        const lines = Array.isArray(blk) ? blk : [String(blk)];
        return lines.map(_escape).join("<br>");
      })
      .join('<br><br>');
  }
  // Fallback: делим сплошной текст на параграфы по \n\n
  return _escape(ev.desc || '')
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, "<br>"))
    .join('<br><br>');
}

// ─── Tags ────────────────────────────────────────────

/**
 * Рендерит теги в указанном контейнере.
 * @param {string[]|string} tags
 * @param {string} containerId
 * @param {function(string): void} [onTagClick] — колбэк при клике на тег
 */
export function renderTags(tags, containerId, onTagClick) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!tags) return;
  const arr = Array.isArray(tags)
    ? tags
    : String(tags).split(',').map(s => s.trim()).filter(Boolean);
  arr.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'tag-pill';
    span.textContent = tag;
    if (onTagClick) {
      span.style.cursor = 'pointer';
      span.title = 'Добавить в поиск';
      span.addEventListener('click', e => {
        e.stopPropagation();
        onTagClick(tag);
      });
    }
    container.appendChild(span);
  });
}
