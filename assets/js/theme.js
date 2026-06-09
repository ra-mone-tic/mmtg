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
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5 ? 'dark' : 'light';
}

/**
 * Проверяет, что themeParams содержит реальные цвета (а не пустой объект).
 */
function hasRealThemeParams(tp) {
  return tp && typeof tp === 'object' && typeof tp.bg_color === 'string' && tp.bg_color.length > 0;
}

/**
 * Маппинг Telegram themeParams ключей → CSS-переменных.
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

  // Если Telegram доступен И bg_color уже пришёл — определяем тему из themeParams
  if (hasRealThemeParams(webapp?.themeParams)) {
    const theme = detectThemeFromBg(webapp.themeParams.bg_color);
    localStorage.setItem('meow-theme', theme);
    return theme;
  }

  // Если Telegram недоступен или themeParams ещё пуст — используем сохранённую тему
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
 * @returns {boolean} true если themeParams были применены
 */
export function applyTelegramTheme() {
  const webapp = TG();
  const params = webapp?.themeParams;

  if (!hasRealThemeParams(params)) return false;

  const root = document.documentElement;

  Object.entries(TG_CSS_MAP).forEach(([tgKey, cssVar]) => {
    if (params[tgKey]) {
      root.style.setProperty(cssVar, params[tgKey]);
    }
  });

  // Синхронизируем нативные компоненты Telegram
  try {
    if (params.bg_color) webapp.setHeaderColor(params.bg_color);
    if (params.secondary_bg_color) webapp.setBackgroundColor(params.secondary_bg_color);
  } catch (e) { /* не критично */ }

  return true;
}

/**
 * Подписывается на themeChanged и применяет палитру динамически.
 * Добавлен retry-механизм: если themeParams ещё не пришли — опрашиваем
 * каждые 200мс (до 5 сек), чтобы поймать момент их появления.
 */
export function bindTelegramTheme() {
  const webapp = TG();
  if (!webapp) {
    console.log('[MEOW][Theme] Telegram WebApp not found — using fallback theme');
    return;
  }

  console.log('[MEOW][Theme] themeParams:', JSON.stringify(webapp.themeParams));

  // Применяем палитру если она уже есть
  const applied = applyTelegramTheme();
  console.log('[MEOW][Theme] Initial apply:', applied ? 'SUCCESS' : 'PENDING');

  // Определяем и устанавливаем dark/light если bg_color уже доступен
  if (applied) {
    const theme = detectThemeFromBg(webapp.themeParams?.bg_color);
    console.log('[MEOW][Theme] Detected theme:', theme, '| bg_color:', webapp.themeParams?.bg_color);
    applyTheme(theme, false);
  }

  // Подписываемся на динамическое изменение темы
  webapp.onEvent?.('themeChanged', () => {
    console.log('[MEOW][Theme] themeChanged fired! New params:', JSON.stringify(TG()?.themeParams));
    if (applyTelegramTheme()) {
      const theme = detectThemeFromBg(TG()?.themeParams?.bg_color);
      console.log('[MEOW][Theme] Theme updated to:', theme);
      applyTheme(theme, true);
    }
  });

  // Retry: если при старте themeParams были пусты — опрашиваем
  if (!applied) {
    let attempts = 0;
    const MAX_ATTEMPTS = 25; // 25 × 200мс = 5 сек
    console.log('[MEOW][Theme] Retry mode: waiting for themeParams...');
    const interval = setInterval(() => {
      attempts++;
      if (applyTelegramTheme()) {
        clearInterval(interval);
        const tp = TG()?.themeParams;
        if (tp) {
          const theme = detectThemeFromBg(tp.bg_color);
          console.log('[MEOW][Theme] Retry success! themeParams:', JSON.stringify(tp), '| theme:', theme);
          applyTheme(theme, true);
          localStorage.setItem('meow-theme', theme);
        }
      } else if (attempts % 5 === 0) {
        console.log(`[MEOW][Theme] Retry ${attempts}/${MAX_ATTEMPTS}...`);
      }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        console.log('[MEOW][Theme] Retry exhausted. Using fallback theme.');
      }
    }, 200);
  }
}
