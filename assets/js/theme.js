// ─── Theme management ────────────────────────────────
import { CFG } from './config.js';
import { $  } from './helpers.js';
import { getMapInstance } from './map-core.js';

export function initTheme() {
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