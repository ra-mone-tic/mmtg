// ─── Application Config ─────────────────────────────
export const REGION_BBOX   = [19.30, 54.00, 23.10, 55.60];
export const REGION_CENTER = [20.50, 54.71];
export const REGION_ZOOM   = 11.5;

export const CFG = {
  MAP_CENTER : REGION_CENTER,
  MAP_ZOOM   : REGION_ZOOM,
  FLY_ZOOM   : 14.5,
  FLY_OFFSET : [0, 240],
  FLY_MS     : 540,
  /** Вычисляется при каждом обращении, т.к. зависит от window.location */
  get SHARE_BASE() {
    return window.location.origin +
           window.location.pathname.replace(/\/+$/, '') +
           '?event=';
  },
  STYLES: {
    dark : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  POSTER_GRADS: [
    ['#6652bb','#a87ef0'], ['#b84f70','#ee80aa'],
    ['#5070bc','#7ca8f2'], ['#4898b8','#74ccee'],
    ['#6ab048','#96e270'], ['#b87a40','#eaaa60'],
  ],
  BBOX: REGION_BBOX,
};
