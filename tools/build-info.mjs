// tools/build-info.mjs – sinh hanoi-info.txt (bản tổng hợp tiếng Việt) từ data/*.json
// Chạy lại sau khi sửa dữ liệu: node tools/build-info.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { deliveryLink, hotelLinks, mapsSearch } from '../js/api.js';
import { PLACE_TYPES, DISH_NAMES, HOTEL_TYPES, HOTEL_AREAS, HOTEL_BUDGETS } from '../js/labels.js';

const read = (f) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const places = read('data/places.json');
const foods = read('data/foods.json');
const hotels = read('data/hotels.json');
const history = read('data/history.json');
const itineraries = read('data/itineraries.json');

const vnd = (n) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
const wikiLink = (title) => (title ? 'https://en.wikipedia.org/wiki/' + title.replace(/ /g, '_') : '');
const today = new Date().toISOString().slice(0, 10);
const out = [];
const line = (s = '') => out.push(s);
const field = (label, value) => { if (value) line(`${label}: ${value}`); };
const section = (title) => { line(); line(); line(title.toUpperCase()); line(); };

line('HÀ NỘI GUIDE: TỔNG HỢP THÔNG TIN DU LỊCH HÀ NỘI');
line(`Sinh tự động từ dữ liệu website (data/*.json) ngày ${today} bằng tools/build-info.mjs, không sửa tay file này.`);
line(`Gồm ${places.length} địa điểm, ${foods.length} quán ăn, ${hotels.length} chỗ nghỉ, ${history.length} mốc lịch sử, ${itineraries.length} lịch trình mẫu.`);

section('1. Dòng lịch sử Thăng Long, Hà Nội');
for (const e of history) {
  line(`${e.year}: ${e.title}`);
  line(e.desc);
  field('Thời gian', e.when);
  field('Nhân vật', e.who);
  field('Địa điểm', e.where);
  line();
  for (const p of e.detail.split(/\n{2,}/).filter(Boolean)) { line(p); line(); }
  if (e.fact) { line(`Có thể bạn chưa biết: ${e.fact}`); line(); }
  line();
}

section(`2. Địa điểm (${places.length})`);
for (const p of places) {
  line(`${p.name} (${p.id})`);
  field('Loại', PLACE_TYPES[p.type]);
  field('Quận', p.district);
  field('Giờ mở cửa', p.hours);
  field('Vé', p.ticket ? vnd(p.ticket) : 'Miễn phí');
  field('Thời gian tham quan', p.duration && `khoảng ${p.duration} phút`);
  field('Mô tả', p.desc);
  field('Gợi ý', p.tip);
  field('Mua vé', p.ticketUrl);
  field('Wikipedia', wikiLink(p.wiki));
  field('Google Maps', mapsSearch(p.lat, p.lng));
  line();
}

const GROUPS = { noodles: 'Phở, bún và các món nước', street: 'Bánh, xôi và đồ ăn đường phố', dessert: 'Cà phê và tráng miệng' };
section(`3. Ẩm thực (${foods.length} quán)`);
for (const [cat, label] of Object.entries(GROUPS)) {
  const list = foods.filter((f) => f.cat === cat);
  line(`${label} (${list.length} quán)`);
  line();
  for (const f of list) {
    line(`${f.name} (${f.id})`);
    field('Món', DISH_NAMES[f.dish] || f.dish);
    if (f.diet?.includes('vegetarian')) field('Chay', 'có');
    field('Địa chỉ', f.address);
    field('Giờ mở cửa', f.hours);
    field('Giá', f.price && `${vnd(f.price.min)} đến ${vnd(f.price.max)}`);
    field('Mô tả', f.desc);
    field('Google Maps', f.links?.maps);
    const grab = deliveryLink('grab', f.links?.grabfood, f.name);
    const shopee = deliveryLink('shopee', f.links?.shopeefood, f.name);
    if (grab || shopee) { field('GrabFood', grab); field('ShopeeFood', shopee); } else field('Giao hàng', 'không, ăn tại quán');
    line();
  }
}

section(`4. Chỗ nghỉ (${hotels.length})`);
for (const h of hotels) {
  const links = hotelLinks(h);
  line(`${h.name} (${h.id})`);
  field('Loại', [HOTEL_TYPES[h.type], h.stars && `${h.stars} sao`].filter(Boolean).join(', '));
  field('Khu vực', HOTEL_AREAS[h.area]);
  field('Ngân sách', HOTEL_BUDGETS[h.budget]);
  field('Địa chỉ', h.address);
  field('Giá mỗi đêm', h.price && `${vnd(h.price.min)} đến ${vnd(h.price.max)}`);
  field('Nguồn giá', h.priceSource && `${h.priceSource}${h.updated ? ` (cập nhật ${h.updated})` : ''}`);
  field('Mô tả', h.desc);
  field('Website', h.links?.website);
  field('Booking.com', links.booking);
  field('Google Maps', links.maps);
  line();
}

const names = Object.fromEntries([...places, ...foods].map((x) => [x.id, x.name]));
section(`5. Lịch trình mẫu (${itineraries.length})`);
for (const it of itineraries) {
  line(it.title);
  it.days.forEach((d, i) => line(`Ngày ${i + 1}: ${d.items.map((id) => names[id] || id).join(', ')}.`));
  line();
}

section('Ghi chú');
line('Giá vé, giá phòng và giờ mở cửa chỉ mang tính tham khảo, có thể thay đổi theo thực tế.');
line('Ảnh trên website lấy từ Wikimedia Commons (CC). Ảnh món ăn là ảnh minh hoạ món, không phải ảnh quán.');
line('Thời tiết và chất lượng không khí: Open-Meteo. Bản đồ: OpenStreetMap.');

writeFileSync(new URL('../hanoi-info.txt', import.meta.url), out.join('\n').replace(/\n{3,}/g, '\n\n\n') + '\n');
console.log('wrote hanoi-info.txt');
