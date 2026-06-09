// ─── Theme management ────────────────────────────────
import { CFG } from './config.js';
import { $, TG } from './helpers.js';
import { getMapInstance } from './map-core.js';

/* ─── Вспомогательные ────────────────────────────────── */

/**
 * Определяет dark/light по яркости bg_color из Telegram themeParams.
 * Возвращает 'dark' или 'light'.
 */
function detectThemeFromBg(bgColor) {
  if (!bgColor) return 'dark';
  // Парсим HEX или rgb/rgba
  let r, g, b;
  if (bgColor.startsWith('#')) {
    const hex = bgColor.replace('#', '');
    const full = hex.length === 3
      ? hex.split('').map(c => c + c).join('')
      : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    const m = bgColor.match(/[\d.]+/g);
    if (!m) return 'dark';
    [r, g, b] = m.map(Number);
  }
  // Relative luminance (simplified)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? 'dark' : 'light';
}

/**
 * Маппинг Telegram themeParams ключей → CSS-переменных.
 * Telegram отдаёт ключи вида: bg_color, text_color, button_color и т.д.
 */
const TG_CSS_MAP = {
  'bg_color'                  : '--tg-theme-bg-color',
  'text_color'                : '--tg-theme-text-color',
  'hint_color'                : '--tg-theme-hint-color',
  'link_color'                : '--tg-theme-link-color',
  'button_color'              : '--tg-theme-button-color',
  'button_text_color'         : '--tg-theme-button-text-color',
  'secondary_bg_color'        : '--tg-theme-secondary-bg-color',
  'accent_text_color'         : '--tg-theme-accent-text-color',
  'section_bg_color'          : '--tg-theme-section-bg-color',
  'section_header_text_color' : '--tg-theme-section-header-text-color',
  'subtitle_text_color'       : '--tg-theme-subtitle-text-color',
  'destructive_text_color'    : '--tg-theme-destructive-text-color',
};

/* ─── Основной API ────────────────────────────────────── */

export function initTheme() {
  const webapp = TG();

  // Если Telegram доступен — определяем тему из themeParams
  if (webapp?.themeParams) {
    const theme = detectThemeFromBg(webapp.themeParams.bg_color);
    localStorage.setItem('meow-theme', theme);
    return theme;
  }

  // Если Telegram недоступен — используем сохранённую тему или fallback
  const saved = localStorage.getItem('meow-theme') || 'dark';
  applyTheme(saved, false);
  return saved;
}

/**
 * @param {string}   t           'dark' | 'light'
 * @param {boolean}  updateMap
 * @param {Function} [onStyleLoad]  коллбэк после смены стиля карты
 */
export function applyTheme(t, updateMap = true, onStyleLoad) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('meow-theme', t);

  const ico = $('theme-icon');
  if (ico) {
    ico.innerHTML = t === 'dark'
      ? `<circle cx="12" cy="12" r="5"/>
         <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
         <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
         <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
         <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
      : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  }

  if (updateMap && getMapInstance()) {
    if (onStyleLoad) getMapInstance().once('style.load', onStyleLoad);
    getMapInstance().setStyle(CFG.STYLES[t]);
  }
  return t;
}

/* ─── Telegram themeParams → CSS-переменные ──────────── */

/**
 * Применяет палитру Telegram на CSS-переменные document.documentElement.
 * Вызывается при старте и при themeChanged.
 */
export function applyTelegramTheme() {
  const webapp = TG();
  if (!webapp?.themeParams) return;

  const params = webapp.themeParams;
  const root = document.documentElement;

  // Устанавливаем CSS-переменные из themeParams
  Object.entries(TG_CSS_MAP).forEach(([tgKey, cssVar]) => {
    if (params[tgKey]) {
      root.style.setProperty(cssVar, params[tgKey]);
    }
  });

  // Синхронизируем нативные компоненты Telegram
  try {
    if (params.bg_color) webapp.setHeaderColor(params.bg_color);
    if (params.secondary_bg_color) webapp.setBackgroundColor(params.secondary_bg_color);
  } catch (e) {
    // Ошибки игнорируем — могут быть, если WebApp не fully ready
  }
}

/**
 * Подписывается на событие themeChanged и применяет палитру динамически.
 * Вызывается один раз при boot().
 */
export function bindTelegramTheme() {
  const webapp = TG();
  if (!webapp) return;

  // Применяем палитру при старте
  applyTelegramTheme();

  // Подписываемся на динамическое изменение темы
  webapp.onEvent?.('themeChanged', () => {
    applyTelegramTheme();
    // Определяем dark/light из нового bg_color и переключаем тему карты если нужно
    const theme = detectThemeFromBg(TG()?.themeParams?.bg_color);
    applyTheme(theme, true);
  });
}