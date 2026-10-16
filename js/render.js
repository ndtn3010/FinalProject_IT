// render.js – tạo HTML cho các thẻ địa điểm, quán ăn, khách sạn, lịch trình mẫu và nút "Thêm vào lịch trình"
import { formatVND, escapeHtml } from './utils.js';
import { PLACE_TYPES, DISH_NAMES, HOTEL_TYPES, HOTEL_AREAS, HOTEL_BUDGETS } from './labels.js';
import { mapsDirections, isMobile, distanceKm, hotelLinks, deliveryLink, HANOI, wikiImage } from './api.js';
import { addToItinerary, isInItinerary } from './storage.js';

// Icon lấy từ bộ icon SVG chung trong trang: icon('clock') -> biểu tượng đồng hồ
export function icon(name, extraClass = '') {
  return `<svg class="ic ${extraClass}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

// Khung ảnh của thẻ. Không có ảnh thì để trống; hàm loadMissingImages() sẽ thử lấy ảnh từ Wikipedia
function cardImage(item, placeholderIcon, badges) {
  const style = item.image ? `style="background-image:url('${escapeHtml(item.image)}')"` : '';
  return `
    <div class="card-img" ${style} data-wiki="${escapeHtml(item.wiki || '')}" role="img" aria-label="${escapeHtml(item.name)}">
      <span class="ph">${icon(placeholderIcon)}</span>
      ${badges}
    </div>`;
}

// Link mở ở tab mới
function linkButton(url, label, className, logo = '') {
  if (!url) return '';
  const logoIcon = logo ? icon(logo, 'ic-logo') : '';
  return `<a class="btn btn-sm ${className}" target="_blank" rel="noopener" href="${escapeHtml(url)}">${logoIcon}${label}</a>`;
}

/* ---------- Địa điểm ---------- */

export function placeCard(place) {
  const ticket = place.ticket ? formatVND(place.ticket) : 'Miễn phí';
  const duration = place.duration ? `<li>${icon('hourglass')} Tham quan ~${place.duration} phút</li>` : '';
  const tip = place.tip ? `<p class="tip">${icon('info')}<span>${escapeHtml(place.tip)}</span></p>` : '';

  return `
  <article class="card">
    ${cardImage(place, 'pin', `<span class="badge">${PLACE_TYPES[place.type] || ''}</span>`)}
    <div class="card-body">
      <h3>${escapeHtml(place.name)}</h3>
      <p class="desc">${escapeHtml(place.desc)}</p>
      <ul class="meta">
        <li>${icon('clock')} ${escapeHtml(place.hours)}</li>
        <li>${icon('ticket')} ${ticket}</li>
        ${duration}
      </ul>
      ${tip}
      <div class="actions">
        ${linkButton(mapsDirections(place.lat, place.lng), icon('pin') + ' Chỉ đường', 'btn-outline')}
        ${addButton(place.id)}
      </div>
    </div>
  </article>`;
}

/* ---------- Quán ăn ---------- */

export function foodCard(food) {
  const dish = DISH_NAMES[food.dish] || food.dish;
  const isVegetarian = food.diet && food.diet.includes('vegetarian');
  const vegBadge = isVegetarian ? `<span class="badge badge-dist tag-veg">${icon('leaf')} Chay</span>` : '';

  const grab = deliveryLink('grab', food.links.grabfood, food.name);
  const shopee = deliveryLink('shopee', food.links.shopeefood, food.name);
  const desktop = isMobile() ? '' : ' btn-desktop';
  const noDelivery = !grab && !shopee ? '<span class="tag">Quán không giao hàng, tới ăn tại chỗ</span>' : '';

  return `
  <article class="card card-food">
    ${cardImage(food, 'wallet', `<span class="badge">${escapeHtml(dish)}</span>${vegBadge}`)}
    <div class="card-body">
      <h3>${escapeHtml(food.name)}</h3>
      <p class="desc">${escapeHtml(food.desc)}</p>
      <ul class="meta">
        <li>${icon('pin')} ${escapeHtml(food.address)}</li>
        <li>${icon('clock')} ${escapeHtml(food.hours)}</li>
        <li>${icon('wallet')} ${formatVND(food.price.min)} - ${formatVND(food.price.max)}</li>
      </ul>
      <div class="actions">
        ${linkButton(food.links.maps, 'Google Maps', 'btn-outline', 'l-googlemaps')}
        ${linkButton(grab, 'GrabFood', 'btn-brand btn-grab' + desktop, 'l-grab')}
        ${linkButton(shopee, 'ShopeeFood', 'btn-brand btn-shopee' + desktop, 'l-shopee')}
        ${noDelivery}
        ${addButton(food.id)}
      </div>
    </div>
  </article>`;
}

/* ---------- Khách sạn ---------- */

export function hotelCard(hotel) {
  const links = hotelLinks(hotel);
  const km = distanceKm(HANOI, hotel);
  const distance = km < 10 ? km.toFixed(1) : Math.round(km);
  const stars = hotel.stars
    ? `<span class="stars" aria-label="${hotel.stars} sao">${icon('star', 'ic-fill').repeat(hotel.stars)}</span>`
    : '';
  const badges = `<span class="badge">${HOTEL_TYPES[hotel.type]}</span><span class="badge badge-dist">${HOTEL_AREAS[hotel.area]}</span>`;

  return `
  <article class="card card-hotel">
    ${cardImage(hotel, 'bed', badges)}
    <div class="card-body">
      <div class="card-top">${stars}<span class="tag">${HOTEL_BUDGETS[hotel.budget]}</span></div>
      <h3>${escapeHtml(hotel.name)}</h3>
      <p class="desc">${escapeHtml(hotel.desc)}</p>
      <ul class="meta">
        <li>${icon('pin')} ${escapeHtml(hotel.address)}</li>
        <li>${icon('locate')} ${distance} km tới Hồ Gươm</li>
        <li>${icon('map')} <a target="_blank" rel="noopener" href="${escapeHtml(links.maps)}">Bản đồ</a></li>
      </ul>
      <div class="price-row">
        <span class="price">Từ ${formatVND(hotel.price.min)}</span><small class="muted">/ đêm</small>
      </div>
      <span class="book-label">Đặt phòng trên</span>
      <div class="book-row">
        ${linkButton(links.booking, 'Booking.com', 'btn-brand btn-booking', 'l-booking')}
        ${linkButton(links.agoda, 'Agoda', 'btn-brand btn-agoda')}
        ${linkButton(links.traveloka, 'Traveloka', 'btn-brand btn-traveloka')}
        ${linkButton(links.google, 'Google Hotels', 'btn-outline', 'l-google')}
      </div>
    </div>
  </article>`;
}

/* ---------- Lịch trình mẫu ---------- */

// names: bảng tra mã -> tên địa điểm / quán ăn
export function sampleCard(sample, names) {
  let stopCount = 0;
  for (const day of sample.days) stopCount += day.items.length;

  const days = sample.days.map((day, index) => {
    const stops = day.items.map((id) => `<li>${escapeHtml(names[id] || id)}</li>`).join('');
    return `<div><strong>Ngày ${index + 1}</strong><ol>${stops}</ol></div>`;
  }).join('');

  return `
  <article class="sample">
    <div>
      <h3>${escapeHtml(sample.title)}</h3>
      <ul class="meta">
        <li>${icon('calendar')} ${sample.days.length} ngày</li>
        <li>${icon('pin')} ${stopCount} điểm dừng</li>
      </ul>
    </div>
    ${days}
    <div class="actions">
      <button type="button" class="btn btn-primary btn-sm" data-use-sample="${escapeHtml(sample.id)}">${icon('arrow')} Dùng lịch trình này</button>
    </div>
  </article>`;
}

/* ---------- Trạng thái tải và trống ---------- */

// Các thẻ xám nhấp nháy trong lúc chờ tải dữ liệu
export function skeletonCards(count = 6, withImage = true) {
  const one = `
  <div class="skeleton" aria-hidden="true">
    ${withImage ? '<div class="sk-img"></div>' : ''}
    <div class="sk-body"><div class="sk-line w60"></div><div class="sk-line w80"></div><div class="sk-line w40"></div></div>
  </div>`;
  return one.repeat(count);
}

export function emptyState(message, button = null, iconName = 'search') {
  const link = button ? `<a class="btn btn-outline" href="${escapeHtml(button.href)}">${escapeHtml(button.label)}</a>` : '';
  return `<div class="empty">${icon(iconName)}<p>${escapeHtml(message)}</p>${link}</div>`;
}

// Thẻ nào chưa có ảnh thì lấy ảnh từ Wikipedia; lỗi thì giữ biểu tượng mặc định
export function loadMissingImages(container) {
  container.querySelectorAll('.card-img[data-wiki]').forEach(async (box) => {
    if (box.style.backgroundImage || !box.dataset.wiki) return;
    const url = await wikiImage(box.dataset.wiki);
    if (url) box.style.backgroundImage = `url('${url}')`;
  });
}

/* ---------- Nút "Thêm vào lịch trình" ---------- */

function addButtonContent(added) {
  return added ? `${icon('check')} Đã thêm` : `${icon('plus')} Thêm vào lịch trình`;
}

function addButton(id) {
  const added = isInItinerary(id);
  const style = added ? 'btn-done' : 'btn-primary';
  return `<button type="button" class="btn btn-sm ${style}" data-add="${escapeHtml(id)}" ${added ? 'disabled' : ''}>${addButtonContent(added)}</button>`;
}

// Cập nhật một nút cho khớp với lịch trình hiện tại
function refreshAddButton(button) {
  const added = isInItinerary(button.dataset.add);
  button.disabled = added;
  button.classList.toggle('btn-primary', !added);
  button.classList.toggle('btn-done', added);
  button.innerHTML = addButtonContent(added);
}

// Bấm nút thì thêm vào ngày 1 của lịch trình
export function bindAddButtons(container) {
  container.querySelectorAll('[data-add]').forEach((button) => {
    button.addEventListener('click', () => {
      addToItinerary(button.dataset.add);
      showToast('Đã thêm vào lịch trình');
    });
  });
}

// Mỗi khi lịch trình đổi (thêm, xoá ở cửa sổ Lịch trình, ở tab khác…), mọi nút trên trang được cập nhật lại.
// Nhờ vậy xoá một điểm thì nút của điểm đó bấm thêm lại được.
document.addEventListener('storagechange', () => {
  document.querySelectorAll('[data-add]').forEach(refreshAddButton);
});

/* ---------- Thông báo nhỏ ở cuối màn hình ---------- */

let toastTimer = null;

export function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
