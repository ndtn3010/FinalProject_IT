import { baseUrl } from './i18n.js';

export const HANOI = { lat: 21.0285, lng: 105.8542 }; // Hồ Hoàn Kiếm

const cache = {};
async function loadJson(name) {
  if (!cache[name]) {
    cache[name] = fetch(`${baseUrl()}data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`Cannot load ${name}.json`);
      return r.json();
    }).catch((err) => { delete cache[name]; throw err; });
  }
  return cache[name];
}
export const getPlaces = () => loadJson('places');
export const getFoods = () => loadJson('foods');
export const getHotels = () => loadJson('hotels');
export const getItineraries = () => loadJson('itineraries');
export const getHistory = () => loadJson('history');

export async function findItem(id) {
  const [p, f] = await Promise.all([getPlaces(), getFoods()]);
  return p.find((x) => x.id === id) || f.find((x) => x.id === id) || null;
}

export async function getWeather() {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${HANOI.lat}&longitude=${HANOI.lng}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,is_day` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=Asia%2FBangkok&forecast_days=5`;
  const r = await fetch(u);
  if (!r.ok) throw new Error('weather');
  return r.json();
}
export async function getAQI() {
  const u = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${HANOI.lat}&longitude=${HANOI.lng}&current=us_aqi,pm2_5&timezone=Asia%2FBangkok`;
  const r = await fetch(u);
  if (!r.ok) throw new Error('aqi');
  return r.json();
}

export function weatherIcon(code, isDay = 1) {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 49) return '🌫️';
  if (code <= 59) return '🌦️';
  if (code <= 69) return '🌧️';
  if (code <= 79) return '🌨️';
  if (code <= 84) return '🌧️';
  return '⛈️';
}
export function aqiLabel(aqi) {
  if (aqi == null) return { text: '', cls: '' };
  if (aqi <= 50) return { text: 'Tốt', cls: 'aqi-good' };
  if (aqi <= 100) return { text: 'Trung bình', cls: 'aqi-moderate' };
  if (aqi <= 150) return { text: 'Kém (nhóm nhạy cảm)', cls: 'aqi-usg' };
  if (aqi <= 200) return { text: 'Xấu', cls: 'aqi-unhealthy' };
  return { text: 'Rất xấu', cls: 'aqi-very' };
}

export async function wikiSummary(title, lang = 'vi') {
  if (!title) return null;
  const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  return r.ok ? r.json() : null;
}

export async function wikiThumb(title, lang = 'en') {
  if (!title) return null;
  const key = `hg.wiki.${lang}.${title}`;
  try { const c = sessionStorage.getItem(key); if (c != null) return c || null; } catch {}
  let url = null;
  try {
    const s = await wikiSummary(title, lang);
    url = s?.thumbnail?.source || s?.originalimage?.source || null;
    // Wikipedia trả thumbnail ~320px; nâng lên 960px (Wikimedia chỉ cho phép một số bề rộng cố định: 960, 1280, 1920)
    if (url) url = url.replace(/\/\d+px-/, '/960px-');
  } catch { url = null; }
  try { sessionStorage.setItem(key, url || ''); } catch {}
  return url;
}

export function distanceKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ---- Deep links: giao đồ ăn. Trang chủ chung -> đổi thành trang tìm kiếm theo tên quán ----
 *  GrabFood   https://food.grab.com/vn/vi/restaurants?search=<tên>   (đã kiểm tra 09/2026)
 *  ShopeeFood https://shopeefood.vn/ha-noi/danh-sach-dia-diem-giao-tan-noi?q=<tên>
 */
export const grabFoodSearch = (q) => `https://food.grab.com/vn/vi/restaurants?search=${encodeURIComponent(q)}`;
export const shopeeFoodSearch = (q) => `https://shopeefood.vn/ha-noi/danh-sach-dia-diem-giao-tan-noi?q=${encodeURIComponent(q)}`;
/** Tên ngắn để tìm trên app giao đồ ăn: bỏ phần trong ngoặc / sau dấu gạch */
export const searchName = (name) => String(name || '').split(/\s[–-]\s|\(/)[0].trim();
/** Nếu link trong JSON chỉ là trang chủ chung (hoặc "auto") thì tự sinh link tìm kiếm */
export function deliveryLink(kind, url, name) {
  if (!url) return '';
  const generic = url === 'auto' || /^https:\/\/(food\.grab\.com\/vn\/[a-z]{2}\/?|shopeefood\.vn\/ha-noi\/?)$/.test(url);
  if (!generic) return url;
  return kind === 'grab' ? grabFoodSearch(searchName(name)) : shopeeFoodSearch(searchName(name));
}
export function mapsSearch(lat, lng) { return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`; }
export function mapsDirections(lat, lng) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`; }
export function mapsRoute(points) {
  if (points.length < 2) return points[0] ? mapsSearch(points[0].lat, points[0].lng) : '#';
  const o = points[0], d = points[points.length - 1];
  const wp = points.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}` +
    (wp ? `&waypoints=${encodeURIComponent(wp)}` : '') + `&travelmode=walking`;
}

/* ---- Deep links: đặt phòng (trang tìm kiếm theo tên khách sạn, người dùng tự chọn ngày) ----
 *  Booking   searchresults.html?ss=<tên>
 *  Agoda     search?city=2758(Hà Nội)&textToSearch=<tên>
 *  Traveloka hotel/vietnam/region/hanoi-10009843
 *  Google    travel/search?q=<tên>
 */
const AGODA_HANOI = '2758';
const TRAVELOKA_HANOI = '10009843';

function withParams(url, params) {
  try {
    const u = new URL(url);
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
    return u.toString();
  } catch { return url; }
}

export function hotelLinks(h) {
  const en = h.name?.en || '';
  const q = /hanoi/i.test(en) ? en : `${en} Hanoi`.trim();
  const l = h.links || {};
  return {
    booking: l.booking || withParams('https://www.booking.com/searchresults.html', { ss: q }),
    agoda: l.agoda || withParams('https://www.agoda.com/search', { city: AGODA_HANOI, textToSearch: en }),
    traveloka: l.traveloka || `https://www.traveloka.com/vi-vn/hotel/vietnam/region/hanoi-${TRAVELOKA_HANOI}`,
    google: l.google || withParams('https://www.google.com/travel/search', { q }),
    maps: mapsSearch(h.lat, h.lng),
  };
}
