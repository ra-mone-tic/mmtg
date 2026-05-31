// Модуль карты для MEOW, ES-модуль
// Экспортирует функцию initMap({theme, center, zoom, bbox, onMapReady, onMapClick}) и методы управления маркерами

let map = null;
let markers = [];

export function getMapInstance() {
  return map;
}

export function clearMarkers() {
  markers.forEach(m => m.ml.remove());
  markers = [];
}

export function addMarkers(events, onMarkerClick) {
  clearMarkers();
  for (const ev of events) {
    const el = document.createElement('div');
    el.className = 'm-pin';
    el.setAttribute('data-id', ev.id);
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', ev.title);
    el.setAttribute('tabindex', '0');
    el.innerHTML = pinSVG(false);
    el.addEventListener('click', e => {
      e.stopPropagation();
      if (onMarkerClick) onMarkerClick(ev);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onMarkerClick) onMarkerClick(ev);
      }
    });
    const marker = new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat([ev.lng,ev.lat]).addTo(map);
    markers.push({id: ev.id, ml: marker});
  }
}

export function setPinActive(id, active) {
  const el = document.querySelector(`.m-pin[data-id="${id}"]`);
  if (!el) return;
  el.innerHTML = pinSVG(active);
  el.classList.toggle('active', active);
}

export function flyTo(ev, zoom = 14.5, offset = [0, 140], ms = 540) {
  map.flyTo({center: [ev.lng, ev.lat], zoom, offset, duration: ms, essential: true});
}

function pinSVG(active) {
  const body = active ? 'var(--c-pin-a)' : 'var(--c-pin)';
  return `<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 2C10.37 2 5 7.37 5 14c0 9.63 12 26 12 26S29 23.63 29 14 23.63 2 17 2z"
      fill="${body}" stroke="var(--c-pin-e)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="17" cy="14" r="4.5" fill="var(--c-pin-e)" opacity="${active?.38:.20}"/>
  </svg>`;
}

export function initMap({theme, center, zoom, bbox, onMapReady, onMapClick}) {
  map = new maplibregl.Map({
    container: 'map',
    style: theme === 'dark'
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center,
    zoom,
    attributionControl: false,
    maxBounds: bbox ? [[bbox[0], bbox[1]], [bbox[2], bbox[3]]] : undefined
  });
  map.on('load', () => {
    if (onMapReady) onMapReady();
  });
  if (onMapClick) map.on('click', onMapClick);
  return map;
}
