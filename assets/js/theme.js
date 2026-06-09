// ─── Theme management ────────────────────────────────
import { CFG } from './config.js';
import { $, TG, isSupports }  from './helpers.js';
import { getMapInstance } from './map-core.js';

/* ── Telegram CSS-переменные ─────────────────────── */

const TG_THEME_KEYS = [
  'bg_color', 'text_color', 'hint_color', 'link_color',
  'button_color', 'button_text_color', 'secondary_bg_color',
  'header_bg_color', 'accent_text_color', 'section_bg_color',
  'section_header_text_color', 'subtitle_text_color', 'destructive_text_color',
];

/**
 * Применяет CSS-переменные Telegram на :root.
 */
function applyTGTheme() {
  const tp = TG()?.themeParams;
  if (!tp) return;
  const root = document.documentElement;
  TG_THEME_KEYS.forEach(key => {
    const val = tp[key];
    if (val) {
      const cssVar = `--tg-${key.replace(/_/g, '-')}`;
      root.style.setProperty(cssVar, val);
    }
  });
  // Авто-определение темы по яркости bg_color
  if (tp.bg_color) {
    root.setAttribute('data-theme', isColorDark(tp.bg_color) ? 'dark' : 'light');
  }
}

function isColorDark(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/* ── Cloud Storage ─────────────────────────────────── */

const STORAGE_KEY = 'meow-theme';

/**
 * Читает тему из Telegram Cloud Storage.
 * @returns {Promise<string|null>}
 */
async function loadFromCloud() {
  // CloudStorage доступен только с версии 6.2 Telegram WebApp
  if (!isSupports('cloudStorage')) return null;
  return new Promise(resolve => {
    TG()?.CloudStorage?.getItem(STORAGE_KEY, (err, val) => {
      resolve(err ? null : val);
    });
  });
}

/**
 * Сохраняет тему в Telegram Cloud Storage.
 * @param {'dark'|'light'} t
 */
function saveToCloud(t) {
  if (!isSupports('cloudStorage')) return;
  TG()?.CloudStorage?.setItem(STORAGE_KEY, t, () => {});
}

/* ── Public API ────────────────────────────────────── */

/**
 * Инициализация темы приложения.
 * Приоритет:
 *   1. Cloud Storage (сохранённый выбор пользователя)
 *   2. Telegram WebApp themeParams (системная тема)
 *   3. fallback 'dark'
 *
 * @returns {'dark'|'light'}
 */
export async function initTheme() {
  // Применяем CSS-переменные Telegram (Telegram WebApp уже инициализирован к этому моменту)
  applyTGTheme();
  // Слушаем смену темы в Telegram (авто-синхронизация)
  TG()?.onEvent('themeChanged', () => {
    const manual = localStorage.getItem(STORAGE_KEY);
    applyTGTheme();
    const tp = TG()?.themeParams;
    if (!manual && tp?.bg_color) {
      const t = isColorDark(tp.bg_color) ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      if (getMapInstance()?.loaded()) {
        getMapInstance().setStyle(CFG.STYLES[t]);
      }
    }
  });

  // 2. Пытаемся прочитать из Cloud Storage
  let theme;
  try {
    theme = await loadFromCloud();
  } catch (_) { /* ignore */ }

  // 3. Если нет в Cloud — читаем localStorage (старый формат)
  if (!theme) theme = localStorage.getItem(STORAGE_KEY);

  // 4. Если ничего нет — определяем из Telegram или fallback
  if (!theme) {
    const tp = TG()?.themeParams;
    if (tp?.bg_color) {
      theme = isColorDark(tp.bg_color) ? 'dark' : 'light';
    } else {
      theme = 'dark';
    }
  }

  // Применяем
  document.documentElement.setAttribute('data-theme', theme);

  return theme;
}

/**
 * Принудительно применить тему (ручное переключение).
 * Сохраняет выбор в localStorage и Cloud Storage.
 *
 * @param {'dark'|'light'}   t
 * @param {boolean}  updateMap
 * @param {Function} [onStyleLoad]
 * @returns {'dark'|'light'}
 */
export function applyTheme(t, updateMap = true, onStyleLoad) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(STORAGE_KEY, t);
  saveToCloud(t);

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

/**
 * Возвращает true, если тема не переопределена пользователем вручную,
 * и мы можем синхронизироваться с Telegram.
 */
export function isAutoTheme() {
  return !localStorage.getItem(STORAGE_KEY);
}