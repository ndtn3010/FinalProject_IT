// trip.js – cửa sổ "Lịch trình" nổi ở góc dưới bên phải trên mọi trang:
// bản đồ các điểm (Leaflet + OpenStreetMap), danh sách theo ngày, nút xoá, link tuyến đường Google Maps.
import { escapeHtml, baseUrl } from './utils.js';
import { getItinerary, removeFromItinerary } from './storage.js';
import { findItem, mapsRoute, mapsDirections, HANOI } from './api.js';
import { icon } from './render.js';

const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';

let map = null;          // bản đồ Leaflet, chỉ tạo khi mở cửa sổ lần đầu
let markers = null;      // lớp chứa các điểm đánh số trên bản đồ
let leafletLoading = null;
let currentDay = 1;

export function initTripPanel() {
  const root = document.createElement('div');
  root.id = 'hg-trip';
  root.innerHTML = `
    <button type="button" class="trip-fab" aria-label="Mở lịch trình của tôi" aria-expanded="false">
      ${icon('map')}<span class="trip-badge" hidden>0</span>
    </button>
    <section class="trip-panel" hidden aria-label="Lịch trình">
      <header>
        <span class="trip-head">${icon('map')}<span>Lịch trình</span><span class="trip-count"></span></span>
        <button type="button" class="trip-close" aria-label="Đóng">${icon('x')}</button>
      </header>
      <div class="trip-map" aria-hidden="true"></div>
      <div class="trip-days chips" hidden></div>
      <div class="trip-body"></div>
      <footer class="trip-foot"></footer>
    </section>`;
  document.body.appendChild(root);

  const openButton = root.querySelector('.trip-fab');
  const panel = root.querySelector('.trip-panel');
  const badge = root.querySelector('.trip-badge');
  const count = root.querySelector('.trip-count');
  const mapBox = root.querySelector('.trip-map');
  const dayTabs = root.querySelector('.trip-days');
  const list = root.querySelector('.trip-body');
  const footer = root.querySelector('.trip-foot');

  function setOpen(open) {
    panel.hidden = !open;
    openButton.setAttribute('aria-expanded', String(open));
    if (open) render();
  }

  openButton.addEventListener('click', () => setOpen(panel.hidden));
  root.querySelector('.trip-close').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) setOpen(false);
  });
  // Lịch trình đổi ở bất cứ đâu thì vẽ lại
  document.addEventListener('storagechange', render);

  async function render() {
    // Đổi danh sách mã thành thông tin đầy đủ của từng điểm
    const itinerary = getItinerary();
    const days = [];
    for (const ids of itinerary.days) {
      const items = [];
      for (const id of ids) {
        const item = await findItem(id);
        if (item) items.push(item);
      }
      days.push(items);
    }

    let total = 0;
    for (const day of days) total += day.length;
    badge.hidden = total === 0;
    badge.textContent = total;
    count.textContent = total > 0 ? total + ' điểm' : '';

    // Các nút chọn ngày (chỉ hiện khi có từ 2 ngày)
    if (currentDay > days.length) currentDay = 1;
    dayTabs.hidden = days.length < 2;
    dayTabs.innerHTML = days.map((_, index) => {
      const active = index + 1 === currentDay ? 'active' : '';
      return `<button type="button" class="chip ${active}" data-day="${index + 1}">Ngày ${index + 1}</button>`;
    }).join('');
    dayTabs.querySelectorAll('[data-day]').forEach((button) => {
      button.addEventListener('click', () => {
        currentDay = Number(button.dataset.day);
        render();
      });
    });

    // Danh sách điểm của ngày đang chọn
    const items = days[currentDay - 1];
    if (total === 0) {
      list.innerHTML = `
        <div class="trip-empty">${icon('map')}
          <p>Chưa có địa điểm nào.</p>
          <p class="muted">Bấm "Thêm vào lịch trình" ở một địa điểm hoặc quán ăn.</p>
        </div>`;
    } else if (items.length === 0) {
      list.innerHTML = '<div class="trip-empty"><p class="muted">Ngày này chưa có điểm nào.</p></div>';
    } else {
      list.innerHTML = '<ol class="trip-list">' + items.map((item, index) => `
        <li>
          <span class="n">${index + 1}</span>
          <div class="trip-item">
            <strong>${escapeHtml(item.name)}</strong>
            <span class="muted">${escapeHtml(item.hours || item.address || '')}</span>
          </div>
          <a class="trip-go" target="_blank" rel="noopener" href="${escapeHtml(item.links?.maps || mapsDirections(item.lat, item.lng))}" title="Chỉ đường">${icon('pin')}</a>
          <button type="button" class="rm" data-remove="${escapeHtml(item.id)}" aria-label="Bỏ khỏi lịch trình">${icon('x')}</button>
        </li>`).join('') + '</ol>';
      list.querySelectorAll('[data-remove]').forEach((button) => {
        button.addEventListener('click', () => removeFromItinerary(button.dataset.remove, currentDay));
      });
    }

    const points = items.filter((item) => item.lat).map((item) => ({ lat: item.lat, lng: item.lng }));
    const routeLink = points.length > 0
      ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${mapsRoute(points)}">${icon('map')} Mở tuyến đường trên Google Maps</a>`
      : '';
    footer.innerHTML = routeLink
      + `<a class="btn btn-primary btn-sm" href="${baseUrl()}pages/itinerary.html">${icon('arrow')} Xem trang lịch trình</a>`;

    // Bản đồ chỉ vẽ khi cửa sổ đang mở
    if (!panel.hidden) drawMap(items);
  }

  async function drawMap(items) {
    try {
      await loadLeaflet();
    } catch {
      mapBox.innerHTML = '<p class="muted trip-map-error">Không tải được bản đồ</p>';
      return;
    }
    if (!map) createMap();

    markers.clearLayers();
    const points = items.filter((item) => item.lat);
    points.forEach((item, index) => {
      const numberIcon = window.L.divIcon({ className: 'trip-marker', html: `<span>${index + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
      window.L.marker([item.lat, item.lng], { icon: numberIcon })
        .bindPopup(`<strong>${escapeHtml(item.name)}</strong><br><span class="muted">${escapeHtml(item.hours || '')}</span>`)
        .addTo(markers);
    });
    // Nối các điểm bằng đường nét đứt theo thứ tự
    if (points.length > 1) {
      const line = points.map((item) => [item.lat, item.lng]);
      window.L.polyline(line, { color: '#b6262c', weight: 3, opacity: 0.8, dashArray: '6 6' }).addTo(markers);
    }

    // Cửa sổ vừa hiện ra nên chờ một nhịp để bản đồ biết kích thước, rồi thu phóng vừa các điểm
    requestAnimationFrame(() => {
      map.invalidateSize();
      if (points.length > 0) map.fitBounds(points.map((item) => [item.lat, item.lng]), { padding: [28, 28], maxZoom: 15 });
      else map.setView([HANOI.lat, HANOI.lng], 13);
    });
  }

  function createMap() {
    // Lăn chuột để zoom chỉ bật sau khi bấm vào bản đồ, để cuộn danh sách không bị "kẹt" vào bản đồ
    map = window.L.map(mapBox, { zoomControl: false, scrollWheelZoom: false });
    window.L.control.zoom({ position: 'topright' }).addTo(map);
    map.on('click focus', () => map.scrollWheelZoom.enable());
    map.on('mouseout blur', () => map.scrollWheelZoom.disable());
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);
    markers = window.L.layerGroup().addTo(map);

    // Nút phóng to / thu nhỏ khung bản đồ
    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.className = 'trip-map-expand';
    expandButton.innerHTML = icon('expand');
    expandButton.setAttribute('aria-label', 'Phóng to / thu nhỏ bản đồ');
    expandButton.addEventListener('click', () => {
      panel.classList.toggle('is-maplarge');
      // khung đổi kích thước xong thì báo bản đồ vẽ lại cho vừa
      setTimeout(() => map.invalidateSize(), 320);
    });
    mapBox.appendChild(expandButton);
  }

  // Hiện số điểm trên nút tròn ngay khi tải trang
  render();
}

// Tải thư viện bản đồ Leaflet lúc cần (lần đầu mở cửa sổ), để trang mở nhanh hơn
function loadLeaflet() {
  if (window.L && window.L.map) return Promise.resolve();
  if (leafletLoading) return leafletLoading;

  leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = resolve;
    script.onerror = () => {
      leafletLoading = null;   // lần sau mở cửa sổ thì thử tải lại
      reject(new Error('Không tải được Leaflet'));
    };
    document.head.appendChild(script);

    setTimeout(() => reject(new Error('Tải Leaflet quá lâu')), 15000);
  });
  return leafletLoading;
}
