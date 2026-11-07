const container = document.getElementById('journey-map');
const buttons = [...document.querySelectorAll('[data-journey-stop]')];
const description = document.getElementById('journey-description');
const NS = 'http://www.w3.org/2000/svg';

function element(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

async function renderJourney() {
  const response = await fetch(new URL('./geography/education-journey.json', import.meta.url));
  if (!response.ok) throw new Error('Journey map unavailable');
  const data = await response.json();
  const svg = element('svg', { viewBox: `0 0 ${data.width} ${data.height}`, focusable: 'false' });
  const lands = element('g', { class: 'journey-land' });
  data.lands.forEach(d => lands.append(element('path', { d })));
  svg.append(lands);
  svg.append(element('text', { x: 425, y: 225, class: 'journey-ocean', 'text-anchor': 'middle' }, 'PACIFIC OCEAN'));

  // The inset separates two cities that are almost the same point at world scale.
  svg.append(element('path', { d: 'M308,140 Q250,265 164,299', class: 'journey-inset-guide' }));
  svg.append(element('text', { x: 52, y: 267, class: 'journey-inset-title' }, 'TAIWAN · A CLOSER LOOK'));
  svg.append(element('path', { d: data.taiwan, class: 'journey-land journey-taiwan' }));
  data.routes.forEach(route => svg.append(element('path', {
    d: route.path, class: 'journey-route', 'data-destination': route.to,
  })));

  function activate(id) {
    select(id);
    const button = buttons.find(item => item.dataset.journeyStop === id);
    button?.focus({ preventScroll: true });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    description.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'nearest' });
  }

  function marker(id, label, x, y) {
    const group = element('g', {
      class: 'journey-marker', 'data-stop': id, role: 'button', tabindex: '0',
      'aria-label': label, 'aria-pressed': 'false', 'aria-controls': `journey-phase-${id}`,
    });
    group.append(element('circle', { cx: x, cy: y, r: 11, class: 'journey-hit-area' }));
    group.append(element('circle', { cx: x, cy: y, r: 9, class: 'journey-halo' }));
    group.append(element('circle', { cx: x, cy: y, r: 3.8, class: 'journey-dot' }));
    group.addEventListener('click', () => activate(id));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(id); }
    });
    return group;
  }

  data.stops.forEach(stop => {
    const [x, y] = stop.insetPoint || stop.point;
    const group = marker(stop.id, stop.label, x, y);
    const taiwan = Boolean(stop.insetPoint);
    const labelX = taiwan ? x + 20 : x + 12;
    const labelY = taiwan ? y + (stop.id === 'tainan' ? -7 : 17) : y + 25;
    group.append(element('text', { x: labelX, y: labelY, class: 'journey-label' }, stop.label));
    svg.append(group);
  });
  const taiwan = marker('kaohsiung', 'Taiwan', ...data.stops[0].point);
  taiwan.append(element('text', { x: 283, y: 153, class: 'journey-label' }, 'Taiwan'));
  svg.append(taiwan);
  container.replaceChildren(svg);

  function select(id) {
    const stop = data.stops.find(item => item.id === id);
    if (!stop) return;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.journeyStop === id)));
    svg.querySelectorAll('[data-stop]').forEach(marker => {
      const active = marker.dataset.stop === id;
      marker.classList.toggle('is-selected', active);
      marker.setAttribute('aria-pressed', String(active));
    });
    svg.querySelectorAll('[data-destination]').forEach(route => route.classList.toggle('is-selected', route.dataset.destination === id));
    description.textContent = stop.description;
  }
  buttons.forEach(button => {
    button.id = `journey-phase-${button.dataset.journeyStop}`;
    button.setAttribute('aria-controls', 'journey-description');
    button.addEventListener('click', () => select(button.dataset.journeyStop));
  });
  select('kaohsiung');
}

renderJourney().catch(() => {
  // Keep all four life stages readable if the optional illustration cannot load.
  container.hidden = true;
  buttons.forEach(button => { button.disabled = true; button.removeAttribute('aria-pressed'); });
});
