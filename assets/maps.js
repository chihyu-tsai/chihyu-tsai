let loading;
export function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js';
    script.integrity = 'sha384-1qC0PnXk2fgMDybOtZF1ui4LM5Sxm7o0TbEkwfxTTVdlZvuNENNGCKUub7d644HP';
    script.crossOrigin = '';
    script.onload = () => resolve(window.maplibregl);
    script.onerror = () => { script.remove(); loading = null; reject(new Error('Map library unavailable.')); };
    document.head.append(script);
  });
  return loading;
}

export function createMap(M, container) {
  const map = new M.Map({
    container,
    style: 'https://tiles.openfreemap.org/styles/positron',
    center: [-75.1652, 39.9526], zoom: 11,
    attributionControl: { compact: true },
    cooperativeGestures: true,
  });
  map.addControl(new M.NavigationControl({ showCompass: false }), 'top-right');
  return map;
}

export function pin() {
  const element = document.createElement('div');
  element.className = 'coffee-pin';
  element.textContent = '☕';
  return element;
}

export function cafeContent(cafe) {
  const content = document.createElement('div');
  content.className = 'coffee-popup';
  const title = document.createElement('strong');
  title.textContent = cafe.name;
  content.append(title);
  const place = [cafe.city, cafe.state, cafe.country].filter(Boolean).join(' · ');
  if (place) {
    const location = document.createElement('p');
    location.textContent = place;
    content.append(location);
  }
  for (const value of [cafe.address, cafe.notes]) {
    if (!value) continue;
    const text = document.createElement('p');
    text.textContent = value;
    content.append(text);
  }
  return content;
}
