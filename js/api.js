// api.js – tải dữ liệu, gọi dịch vụ bên ngoài (thời tiết, Wikipedia) và tạo các đường link
import { baseUrl, withVersion } from './utils.js';

// Toạ độ Hồ Hoàn Kiếm, dùng làm "trung tâm Hà Nội"
export const HANOI = { lat: 21.0285, lng: 105.8542 };

/* ---------- Dữ liệu trong thư mục data/ ---------- */

// Nhớ các file đã tải để không phải tải lại
const loadedFiles = {};

async function loadJson(name) {
  if (!loadedFiles[name]) {
    const response = await fetch(withVersion(baseUrl() + 'data/' + name + '.json'));
    if (!response.ok) throw new Error('Không tải được ' + name + '.json');
    loadedFiles[name] = await response.json();
  }
  return loadedFiles[name];
}

export function getPlaces() { return loadJson('places'); }
export function getFoods() { return loadJson('foods'); }
export function getHotels() { return loadJson('hotels'); }
export function getItineraries() { return loadJson('itineraries'); }
export function getHistory() { return loadJson('history'); }

// Tìm một địa điểm hoặc quán ăn theo mã (id)
export async function findItem(id) {
  const places = await getPlaces();
  const foods = await getFoods();
  return places.find((p) => p.id === id) || foods.find((f) => f.id === id) || null;
}

/* ---------- Thời tiết (Open-Meteo, miễn phí, không cần đăng ký) ---------- */

export async function getWeather() {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + HANOI.lat + '&longitude=' + HANOI.lng
    + '&current=temperature_2m,relative_humidity_2m,weather_code,is_day'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
    + '&timezone=Asia%2FBangkok&forecast_days=5';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Không lấy được thời tiết');
  return response.json();
}

// Chỉ số chất lượng không khí (AQI)
export async function getAirQuality() {
  const url = 'https://air-quality-api.open-meteo.com/v1/air-quality'
    + '?latitude=' + HANOI.lat + '&longitude=' + HANOI.lng
    + '&current=us_aqi&timezone=Asia%2FBangkok';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Không lấy được chỉ số AQI');
  return response.json();
}

// Mã thời tiết của Open-Meteo -> biểu tượng
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

// Chỉ số AQI -> nhãn chữ và tên class CSS để tô màu
export function aqiLabel(aqi) {
  if (aqi == null) return { text: '', cls: '' };
  if (aqi <= 50) return { text: 'Tốt', cls: 'aqi-good' };
  if (aqi <= 100) return { text: 'Trung bình', cls: 'aqi-moderate' };
  if (aqi <= 150) return { text: 'Kém (nhóm nhạy cảm)', cls: 'aqi-usg' };
  if (aqi <= 200) return { text: 'Xấu', cls: 'aqi-unhealthy' };
  return { text: 'Rất xấu', cls: 'aqi-very' };
}

/* ---------- Ảnh từ Wikipedia (cho mục chưa có ảnh trong dữ liệu) ---------- */

export async function wikiImage(title) {
  if (!title) return null;

  // Đã hỏi trong lần mở web này rồi thì dùng lại, không hỏi Wikipedia lần nữa
  const cacheKey = 'hg.wiki.' + title;
  const saved = sessionStorage.getItem(cacheKey);
  if (saved !== null) return saved || null;

  let imageUrl = null;
  try {
    const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title));
    if (response.ok) {
      const summary = await response.json();
      imageUrl = summary.thumbnail?.source || null;
      // Wikipedia trả ảnh nhỏ (~320px); xin bản 960px (Wikimedia chỉ cho một số bề rộng cố định)
      if (imageUrl) imageUrl = imageUrl.replace(/\/\d+px-/, '/960px-');
    }
  } catch {
    imageUrl = null;
  }
  sessionStorage.setItem(cacheKey, imageUrl || '');
  return imageUrl;
}

/* ---------- Khoảng cách ---------- */

// Khoảng cách đường chim bay giữa hai toạ độ (km), công thức Haversine
export function distanceKm(a, b) {
  const EARTH_RADIUS = 6371;
  const toRadian = (degree) => degree * Math.PI / 180;
  const dLat = toRadian(b.lat - a.lat);
  const dLng = toRadian(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadian(a.lat)) * Math.cos(toRadian(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

export function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/* ---------- Link Google Maps ---------- */

export function mapsSearch(lat, lng) {
  return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
}

// Chỉ đường đi bộ tới một điểm (điểm xuất phát là vị trí hiện tại của người dùng)
export function mapsDirections(lat, lng) {
  return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng + '&travelmode=walking';
}

// Tuyến đường qua nhiều điểm: điểm đầu, các điểm dừng ở giữa, điểm cuối
export function mapsRoute(points) {
  if (points.length === 0) return '#';
  if (points.length === 1) return mapsSearch(points[0].lat, points[0].lng);

  const start = points[0];
  const end = points[points.length - 1];
  const middle = points.slice(1, -1).map((p) => p.lat + ',' + p.lng).join('|');

  let url = 'https://www.google.com/maps/dir/?api=1'
    + '&origin=' + start.lat + ',' + start.lng
    + '&destination=' + end.lat + ',' + end.lng;
  if (middle) url += '&waypoints=' + encodeURIComponent(middle);
  return url + '&travelmode=walking';
}

/* ---------- Link giao đồ ăn ---------- */

// Tên ngắn để tìm trên app: "Bún chả Hương Liên (Bún chả Obama)" -> "Bún chả Hương Liên"
function shortName(name) {
  return String(name || '').split(' (')[0].split(' – ')[0].split(' - ')[0].trim();
}

// kind là "grab" hoặc "shopee". Giá trị link trong foods.json:
//   ""           -> quán không giao hàng, không có nút
//   "auto"       -> tự tạo link tìm kiếm theo tên quán
//   link cụ thể  -> dùng nguyên link đó
export function deliveryLink(kind, link, restaurantName) {
  if (!link) return '';
  if (link !== 'auto') return link;

  const keyword = encodeURIComponent(shortName(restaurantName));
  if (kind === 'grab') return 'https://food.grab.com/vn/vi/restaurants?search=' + keyword;
  return 'https://shopeefood.vn/ha-noi/danh-sach-dia-diem-giao-tan-noi?q=' + keyword;
}

/* ---------- Link đặt phòng khách sạn ---------- */

// Mở trang tìm kiếm theo tên khách sạn; người dùng chọn ngày và số khách ngay trên trang đó
export function hotelLinks(hotel) {
  const englishName = hotel.nameEn || hotel.name;
  const searchName = /hanoi/i.test(englishName) ? englishName : englishName + ' Hanoi';
  const own = hotel.links || {};

  return {
    booking: own.booking || 'https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(searchName),
    agoda: own.agoda || 'https://www.agoda.com/search?city=2758&textToSearch=' + encodeURIComponent(englishName),
    traveloka: own.traveloka || 'https://www.traveloka.com/vi-vn/hotel/vietnam/region/hanoi-10009843',
    google: own.google || 'https://www.google.com/travel/search?q=' + encodeURIComponent(searchName),
    maps: mapsSearch(hotel.lat, hotel.lng),
  };
}
