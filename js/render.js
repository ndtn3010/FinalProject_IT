// render.js – tạo card địa điểm / món ăn / khách sạn / lịch trình mẫu + skeleton, empty state
import { t, L, has, formatVND, getLang } from './i18n.js';
import { mapsDirections, isMobile, distanceKm, hotelLinks, deliveryLink, HANOI, wikiThumb } from './api.js';
import { addToItinerary, isInItinerary } from './storage.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Icon từ sprite trong layout: icon('clock') */
export const icon = (name, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const imgStyle = (url) => (url ? `style="background-image:url('${esc(url)}')"` : '');

export function placeCard(p, { distance } = {}) {
  const added = isInItinerary(p.id);
  return `
  <article class="card" data-id="${esc(p.id)}">
    <div class="card-img" ${imgStyle(p.image)} data-wiki="${esc(p.wiki?.en || '')}" role="img" aria-label="${esc(L(p.name))}">
      <span class="ph">${icon('pin')}</span>
      <span class="badge">${t('places.' + p.type)}</span>
      ${distance != null ? `<span class="badge badge-dist">${distance.toFixed(1)} km</span>` : ''}
    </div>
    <div class="card-body">
      <h3>${esc(L(p.name))}</h3>
      <p class="desc">${esc(L(p.desc))}</p>
      <ul class="meta">
        <li>${icon('clock')} ${esc(p.hours || '')}</li>
        <li>${icon('ticket')} ${p.ticket ? formatVND(p.ticket) : t('places.free')}</li>
        ${p.duration ? `<li>${icon('hourglass')} ${t('places.duration', { n: p.duration })}</li>` : ''}
      </ul>
      ${p.tip ? `<p class="tip">${icon('info')}<span>${esc(L(p.tip))}</span></p>` : ''}
      <div class="actions">
        <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${mapsDirections(p.lat, p.lng)}">${icon('pin')} ${t('places.directions')}</a>
        <button type="button" class="btn btn-sm ${added ? 'btn-done' : 'btn-primary'}" data-add="${esc(p.id)}" ${added ? 'disabled' : ''}>
          ${icon(added ? 'check' : 'plus')} ${t(added ? 'places.added' : 'places.add')}
        </button>
      </div>
    </div>
  </article>`;
}

const dishLabel = (dish) => (has('dish.' + dish) ? t('dish.' + dish) : dish);

export function foodCard(f) {
  const mobile = isMobile();
  const link = (url, label, ic, cls) =>
    url ? `<a class="btn btn-sm ${cls}" target="_blank" rel="noopener" href="${esc(url)}">${ic ? icon(ic, 'ic-logo') : ''}${label}</a>` : '';
  const added = isInItinerary(f.id);
  const veg = f.diet?.includes('vegetarian');
  return `
  <article class="card card-food" data-id="${esc(f.id)}">
    <div class="card-img" ${imgStyle(f.image)} data-wiki="${esc(f.wiki?.en || '')}" role="img" aria-label="${esc(L(f.name))}">
      <span class="ph">${icon('wallet')}</span>
      <span class="badge">${esc(dishLabel(f.dish))}</span>
      ${veg ? `<span class="badge badge-dist tag-veg">${icon('leaf')} ${t('food.vegetarian')}</span>` : ''}
    </div>
    <div class="card-body">
      <h3>${esc(L(f.name))}</h3>
      <p class="desc">${esc(L(f.desc))}</p>
      <ul class="meta">
        <li>${icon('pin')} ${esc(f.address)}</li>
        <li>${icon('clock')} ${esc(f.hours)}</li>
        <li>${icon('wallet')} ${formatVND(f.price?.min)} - ${formatVND(f.price?.max)}</li>
      </ul>
      <div class="actions">
        ${link(f.links?.maps, t('food.maps'), 'l-googlemaps', 'btn-outline')}
        ${link(deliveryLink('grab', f.links?.grabfood, f.name?.vi), t('food.grab'), 'l-grab', 'btn-brand btn-grab' + (mobile ? '' : ' btn-desktop'))}
        ${link(deliveryLink('shopee', f.links?.shopeefood, f.name?.vi), t('food.shopee'), 'l-shopee', 'btn-brand btn-shopee' + (mobile ? '' : ' btn-desktop'))}
        ${!f.links?.grabfood && !f.links?.shopeefood ? `<span class="tag">${t('food.noDelivery')}</span>` : ''}
        <button type="button" class="btn btn-sm ${added ? 'btn-done' : 'btn-primary'}" data-add="${esc(f.id)}" ${added ? 'disabled' : ''}>
          ${icon(added ? 'check' : 'plus')} ${t(added ? 'places.added' : 'places.add')}
        </button>
      </div>
    </div>
  </article>`;
}

/** Card khách sạn: nút đặt phòng lấy ngày/số khách từ My Trip */
export function hotelCard(h, trip) {
  const links = hotelLinks(h, trip, getLang());
  const km = distanceKm(HANOI, h);
  const stars = h.stars ? `<span class="stars" aria-label="${t('hotels.stars', { n: h.stars })}">${icon('star', 'ic-fill').repeat(h.stars)}</span>` : '';
  const book = (url, label, cls, ic) => `<a class="btn btn-sm btn-brand ${cls}" target="_blank" rel="noopener" href="${esc(url)}">${ic ? icon(ic, 'ic-logo') : ''}${label}</a>`;
  return `
  <article class="card card-hotel" data-id="${esc(h.id)}">
    <div class="card-img" ${imgStyle(h.image)} data-wiki="${esc(h.wiki?.en || '')}" role="img" aria-label="${esc(L(h.name))}">
      <span class="ph">${icon('bed')}</span>
      <span class="badge">${t('hotels.type.' + h.type)}</span>
      <span class="badge badge-dist">${t('hotels.area.' + h.area)}</span>
    </div>
    <div class="card-body">
      <div class="card-top">${stars}<span class="tag">${t('hotels.budget.' + h.budget)}</span></div>
      <h3>${esc(L(h.name))}</h3>
      <p class="desc">${esc(L(h.desc))}</p>
      <ul class="meta">
        <li>${icon('pin')} ${esc(h.address)}</li>
        <li>${icon('locate')} ${t('hotels.center', { d: km < 10 ? km.toFixed(1) : Math.round(km) })}</li>
        <li>${icon('map')} <a target="_blank" rel="noopener" href="${esc(links.maps)}">${t('hotels.map')}</a></li>
      </ul>
      <div class="price-row">
        <span class="price">${t('hotels.from')} ${formatVND(h.price?.min)}</span><small class="muted">${t('hotels.perNight')}</small>
      </div>
      <span class="book-label">${t('hotels.book')}</span>
      <div class="book-row">
        ${book(links.booking, 'Booking.com', 'btn-booking', 'l-booking')}
        ${book(links.agoda, 'Agoda', 'btn-agoda')}
        ${book(links.traveloka, 'Traveloka', 'btn-traveloka')}
        <a class="btn btn-sm btn-outline" target="_blank" rel="noopener" href="${esc(links.google)}">${icon('l-google', 'ic-logo')}Google Hotels</a>
      </div>
    </div>
  </article>`;
}

/** Card lịch trình mẫu. names: map id -> tên đã dịch */
export function sampleCard(it, names) {
  const stops = it.days.reduce((s, d) => s + d.items.length, 0);
  return `
  <article class="sample" data-sample="${esc(it.id)}">
    <div>
      <h3>${esc(L(it.title))}</h3>
      <ul class="meta">
        <li>${icon('calendar')} ${t('itinerary.days', { n: it.days.length })}</li>
        <li>${icon('pin')} ${t('itinerary.stops', { n: stops })}</li>
      </ul>
    </div>
    ${it.days.map((d, i) => `<div><strong>${t('itinerary.day', { n: i + 1 })}</strong><ol>${d.items.map((id) => `<li>${esc(names[id] || id)}</li>`).join('')}</ol></div>`).join('')}
    <div class="actions"><button type="button" class="btn btn-primary btn-sm" data-use-sample="${esc(it.id)}">${icon('arrow')} ${t('itinerary.use')}</button></div>
  </article>`;
}

/** Card gọn cho chatbot */
export function miniCard(item) {
  const isFood = !!item.links;
  const url = isFood ? item.links.maps : mapsDirections(item.lat, item.lng);
  return `
  <div class="mini-card" data-id="${esc(item.id)}">
    <strong>${esc(L(item.name))}</strong>
    <span class="muted">${esc(item.hours || '')}${item.ticket != null && !isFood ? ' · ' + (item.ticket ? formatVND(item.ticket) : t('places.free')) : ''}${isFood && item.price ? ' · ' + formatVND(item.price.min) + '+' : ''}</span>
    <div class="mini-actions">
      <a target="_blank" rel="noopener" href="${esc(url)}" title="${t('food.maps')}">${icon('l-googlemaps', 'ic-logo')}</a>
      ${isFood && item.links.grabfood ? `<a target="_blank" rel="noopener" href="${esc(deliveryLink('grab', item.links.grabfood, item.name?.vi))}" title="GrabFood">${icon('l-grab', 'ic-logo')}</a>` : ''}
      ${isFood && item.links.shopeefood ? `<a target="_blank" rel="noopener" href="${esc(deliveryLink('shopee', item.links.shopeefood, item.name?.vi))}" title="ShopeeFood">${icon('l-shopee', 'ic-logo')}</a>` : ''}
      <button type="button" data-add="${esc(item.id)}" title="${t('places.add')}">${icon('plus')}</button>
    </div>
  </div>`;
}

/** Skeleton card trong lúc tải */
export function skeletonCards(n = 6, withImg = true) {
  return Array.from({ length: n }, () => `
  <div class="skeleton" aria-hidden="true">
    ${withImg ? '<div class="sk-img"></div>' : ''}
    <div class="sk-body"><div class="sk-line w60"></div><div class="sk-line w80"></div><div class="sk-line w40"></div></div>
  </div>`).join('');
}

export function emptyState(msg, { href, label, ic = 'search' } = {}) {
  return `<div class="empty">${icon(ic)}<p>${esc(msg)}</p>${href ? `<a class="btn btn-outline" href="${esc(href)}">${esc(label)}</a>` : ''}</div>`;
}

/** Nạp ảnh Wikipedia cho card chưa có ảnh (fallback, lỗi thì giữ placeholder) */
export function hydrateImages(root = document) {
  root.querySelectorAll('.card-img[data-wiki]').forEach(async (el) => {
    const title = el.dataset.wiki;
    if (!title || el.style.backgroundImage) return;
    const url = await wikiThumb(title, 'en');
    if (url) el.style.backgroundImage = `url('${url}')`;
  });
}

/** Gắn handler cho tất cả nút "Thêm vào lịch trình" trong root */
export function bindAddButtons(root = document) {
  root.querySelectorAll('[data-add]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      addToItinerary(btn.dataset.add, 1);
      btn.disabled = true;
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-done');
      btn.innerHTML = `${icon('check')} ${t('places.added')}`;
      toast(t('chat.added'));
    });
  });
}

export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2200);
}
