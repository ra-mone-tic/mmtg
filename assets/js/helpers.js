// Helpers & UI utilities
import { CFG } from './config.js';

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
 * Мета-строки. Скрывает адрес/время если пусты.
 */
export function metaHTML(ev, showAddress = true) {
  const dateDisplay = ev.date === fmt(new Date()) ? 'Сегодня' : ev.date;
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
      .map(blk => `<p>${blk.map(_escape).join("<br>")}</p>`)
      .join('');
  }
  return _escape(ev.desc || '').replace(/\n/g, "<br>");
}

// ─── Telegram Feature Detection ──────────────────────

/**
 * Проверяет, поддерживается ли указанная функция Telegram WebApp.
 * @param {'cloudStorage'|'backButton'|'mainButton'|'hapticFeedback'} feature
 * @returns {boolean}
 */
export function isSupports(feature) {
  const webapp = TG();
  if (!webapp) return false;
  switch (feature) {
    case 'cloudStorage':
      // CloudStorage доступен с версии 6.2
      return !!webapp.isVersionAtLeast?.('6.2') && !!webapp.CloudStorage;
    case 'backButton':
      return !!webapp.BackButton;
    case 'mainButton':
      return !!webapp.MainButton;
    case 'hapticFeedback':
      return !!webapp.HapticFeedback;
    default:
      return false;
  }
}

// ─── Telegram BackButton ─────────────────────────────

/**
 * Показывает или скрывает нативную кнопку «Назад» Telegram.
 */
export function showBackButton() {
  const bb = TG()?.BackButton;
  if (bb) bb.show();
}

export function hideBackButton() {
  const bb = TG()?.BackButton;
  if (bb) {
    try { bb.hide(); } catch (_) {}
  }
}

// ─── Tags ────────────────────────────────────────────

export function renderTags(tags, containerId) {
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
    container.appendChild(span);
  });
}