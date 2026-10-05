// trip.js – cửa sổ nổi "Lịch trình" trên mọi trang: bản đồ Leaflet (OSM) + danh sách điểm theo ngày,
// xoá nhanh, mở tuyến đường Google Maps. Tự cập nhật khi lịch trình thay đổi (sự kiện storagechange).
import { t, L as pick, applyDom, baseUrl } from './i18n.js';
import { getItinerary, removeFromItinerary } from './storage.js';
import { findItem, mapsRoute, mapsDirections, HANOI } from './api.js';
import { icon } from './render.js';

const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let map = null, layer = null, leaflet = null; // leaflet: promise nạp thư viện
let day = 1;

export function initTripPanel() {
  const root = document.createElement('div');
  root.id = 'hg-trip';
  root.innerHTML = `
    <button type="button" class="trip-fab" data-i18n-aria="trip.open" aria-label="Itinerary" aria-expanded="false">
      ${icon('map')}<span class="trip-badge" hidden>0</span>
    </button>
    <section class="trip-panel" hidden aria-label="Itinerary">
      <header>
        <span class="trip-head">${icon('map')}<span data-i18n="trip.title"></span><span class="trip-count"></span></span>
        <button type="button" class="trip-close" aria-label="Close">${icon('x')}</button>
      </header>
      <div class="trip-map" aria-hidden="true"></div>
      <div class="trip-days chips" hidden></div>
      <div class="trip-body"></div>
      <footer class="trip-foot"></footer>
    </section>`;
  document.body.appendChild(root);
  applyDom(root);

  const fab = root.querySelector('.trip-fab');
  const panel = root.querySelector('.trip-panel');
  const badge = root.querySelector('.trip-badge');
  const count = root.querySelector('.trip-count');
  const mapEl = root.querySelector('.trip-map');
  const daysEl = root.querySelector('.trip-days');
  const body = root.querySelector('.trip-body');
  const foot = root.querySelector('.trip-foot');

  const setOpen = (open) => {
    panel.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    if (open) {
      document.dispatchEvent(new CustomEvent('hg:panel', { detail: 'trip' }));
      render(true);
    }
  };
  fab.addEventListener('click', () => setOpen(panel.hidden));
  root.querySelector('.trip-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('hg:panel', (e) => { if (e.detail !== 'trip') setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
  document.addEventListener('storagechange', () => render(!panel.hidden));
  document.addEventListener('langchange', () => render(!panel.hidden));

  /** Vẽ lại danh sách; withMap=true thì cập nhật cả bản đồ (chỉ khi panel đang mở) */
  async function render(withMap) {
    const it = getItinerary();
    const days = await Promise.all(it.days.map((d) => Promise.all(d.map(findItem))));
    const total = days.flat().filter(Boolean).length;

    badge.hidden = total === 0;
    badge.textContent = String(total);
    count.textContent = total ? t('trip.stops', { n: total }) : '';

    if (day > days.length) day = 1;
    daysEl.hidden = days.length < 2;
    daysEl.innerHTML = days.map((_, i) => `<button type="button" class="chip ${i + 1 === day ? 'active' : ''}" data-day="${i + 1}">${t('itinerary.day', { n: i + 1 })}</button>`).join('');
    daysEl.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { day = +b.dataset.day; render(true); }));

    const objs = days[day - 1].filter(Boolean);
    if (!total) {
      body.innerHTML = `<div class="trip-empty">${icon('map')}<p>${esc(t('itinerary.empty'))}</p><p class="muted">${esc(t('trip.emptyHint'))}</p></div>`;
    } else if (!objs.length) {
      body.innerHTML = `<div class="trip-empty"><p class="muted">${esc(t('trip.dayEmpty'))}</p></div>`;
    } else {
      body.innerHTML = `<ol class="trip-list">${objs.map((o, i) => `
        <li data-id="${esc(o.id)}">
          <span class="n">${i + 1}</span>
          <div class="trip-item">
            <strong>${esc(pick(o.name))}</strong>
            <span class="muted">${esc(o.hours || o.address || '')}</span>
          </div>
          <a class="trip-go" target="_blank" rel="noopener" href="${esc(o.links?.maps || mapsDirections(o.lat, o.lng))}" title="${esc(t('places.directions'))}">${icon('pin')}</a>
          <button type="button" class="rm" data-rm="${esc(o.id)}" aria-label="${esc(t('trip.remove'))}">${icon('x')}</button>
        </li>`).join('')}</ol>`;
      body.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => removeFromItinerary(b.dataset.rm, day)));
    }

    const pts = objs.filter((o) => o.lat).map((o) => ({ lat: o.lat, lng: o.lng }));
    foot.innerHTML = `
      ${pts.length ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${mapsRoute(pts)}">${icon('map')} ${esc(t('itinerary.route'))}</a>` : ''}
      <a class="btn btn-primary btn-sm" href="${baseUrl()}pages/itinerary.html">${icon('arrow')} ${esc(t('trip.page'))}</a>`;

    if (withMap) updateMap(objs);
  }

  async function updateMap(objs) {
    try {
      await ensureLeaflet();
    } catch {
      mapEl.innerHTML = `<p class="muted trip-map-error">${esc(t('trip.mapError'))}</p>`;
      return;
    }
    const Lf = window.L;
    if (!map) {
      // Zoom: nút +/−, chạm hai ngón, nhấp đúp; lăn chuột chỉ sau khi bấm vào bản đồ (để cuộn panel không bị "kẹt")
      map = Lf.map(mapEl, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, touchZoom: true, doubleClickZoom: true });
      Lf.control.zoom({ position: 'topright' }).addTo(map);
      map.on('click focus', () => map.scrollWheelZoom.enable());
      map.on('mouseout blur', () => map.scrollWheelZoom.disable());
      Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
      layer = Lf.layerGroup().addTo(map);
      // Nút phóng to / thu nhỏ khung bản đồ
      const expand = document.createElement('button');
      expand.type = 'button';
      expand.className = 'trip-map-expand';
      expand.innerHTML = icon('expand');
      expand.setAttribute('aria-label', t('trip.expand'));
      expand.addEventListener('click', () => {
        panel.classList.toggle('is-maplarge');
        setTimeout(() => map.invalidateSize(), 320);
      });
      mapEl.addEventListener('transitionend', () => map.invalidateSize());
      mapEl.appendChild(expand);
    }
    layer.clearLayers();
    const pts = objs.filter((o) => o.lat);
    pts.forEach((o, i) => {
      Lf.marker([o.lat, o.lng], { icon: Lf.divIcon({ className: 'trip-marker', html: `<span>${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
        .bindPopup(`<strong>${esc(pick(o.name))}</strong><br><span class="muted">${esc(o.hours || '')}</span>`)
        .addTo(layer);
    });
    if (pts.length > 1) Lf.polyline(pts.map((o) => [o.lat, o.lng]), { color: '#b6262c', weight: 3, opacity: .8, dashArray: '6 6' }).addTo(layer);
    // Panel vừa hiện nên kích thước map mới có; đợi một frame rồi mới fit
    requestAnimationFrame(() => {
      map.invalidateSize();
      if (pts.length) map.fitBounds(pts.map((o) => [o.lat, o.lng]), { padding: [28, 28], maxZoom: 15 });
      else map.setView([HANOI.lat, HANOI.lng], 13);
    });
  }

  // Badge sẵn sàng ngay khi tải trang (không cần mở panel)
  render(false);
}

function ensureLeaflet() {
  if (window.L?.map) return Promise.resolve();
  if (leaflet) return leaflet;
  leaflet = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = LEAFLET_JS; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { leaflet = null; reject(new Error('leaflet load failed')); };
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('leaflet timeout')), 15000);
  });
  return leaflet;
}
