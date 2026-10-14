// app.js – khởi tạo chung cho mọi trang + logic theo data-page
import { loadStrings, t, L, formatVND, fold } from './i18n.js';
import * as api from './api.js';
import { placeCard, foodCard, hotelCard, sampleCard, skeletonCards, emptyState, hydrateImages, bindAddButtons, toast, icon } from './render.js';
import { getItinerary, removeFromItinerary, clearItinerary, setItinerary, KEY_ITIN } from './storage.js';
import { initTripPanel } from './trip.js';

const page = document.body.dataset.page;
const pages = { home, places, food, hotels, history, itinerary };

(async function boot() {
  initMenu();
  initPageTransitions();
  await loadStrings();
  initTripPanel();
  markActiveNav();
  initNavIndicator();
  initReveal();
  if (pages[page]) await safe(pages[page]);
})();

/** Không để lỗi JS làm trang trắng: log và hiện thông báo nhẹ */
async function safe(fn) {
  try { await fn(); } catch (err) { console.error(err); toast(t('weather.error')); }
}

function markActiveNav() {
  document.querySelectorAll('.nav a').forEach((a) => {
    const on = a.dataset.page === page;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
  });
}

function initMenu() {
  const header = document.querySelector('.header');
  const btn = document.querySelector('[data-menu-toggle]');
  if (!header || !btn) return;
  const set = (open) => { header.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => set(!header.classList.contains('is-open')));
  header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  matchMedia('(min-width: 861px)').addEventListener('change', (e) => { if (e.matches) set(false); });
}

/** Chuyển trang mượt: bấm link nội bộ thì fade nội dung ra (.is-leaving) rồi mới điều hướng */
function initPageTransitions() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, 150);
  });
  // Quay lại bằng nút Back (bfcache) thì bỏ trạng thái đang rời trang
  window.addEventListener('pageshow', (e) => { if (e.persisted) document.body.classList.remove('is-leaving'); });
}

/** Ô highlight trên menu trượt từ tab cũ sang tab mới.
 *  Lúc bấm tab: lưu vị trí ô hiện tại vào sessionStorage; trang mới: đặt ô ở vị trí cũ rồi trượt tới tab đang mở. */
function initNavIndicator() {
  const nav = document.querySelector('.nav');
  const ind = nav?.querySelector('.nav-indicator');
  if (!nav || !ind) return;
  const KEY = 'hg.nav.from';
  const rectOf = (a) => { const r = a.getBoundingClientRect(), n = nav.getBoundingClientRect(); return { x: r.left - n.left, y: r.top - n.top, w: r.width, h: r.height }; };
  const apply = (p) => { ind.style.transform = `translate(${p.x}px, ${p.y}px)`; ind.style.width = p.w + 'px'; ind.style.height = p.h + 'px'; };
  const place = (animate) => {
    const active = nav.querySelector('a.active');
    if (!active || getComputedStyle(ind).display === 'none') { ind.classList.remove('is-ready'); return; }
    ind.classList.toggle('is-animating', animate);
    apply(rectOf(active));
    ind.classList.add('is-ready');
  };
  let from = null;
  try { from = JSON.parse(sessionStorage.getItem(KEY)); sessionStorage.removeItem(KEY); } catch {}
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (from && !reduce && Math.abs(from.vw - innerWidth) < 2 && getComputedStyle(ind).display !== 'none') {
    ind.classList.remove('is-animating');
    apply(from);
    ind.classList.add('is-ready');
    void ind.offsetWidth; // ép layout để transition chạy từ vị trí cũ
    requestAnimationFrame(() => requestAnimationFrame(() => place(true)));
  } else {
    place(false);
  }
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    const cur = nav.querySelector('a.active');
    if (cur) try { sessionStorage.setItem(KEY, JSON.stringify({ ...rectOf(cur), vw: innerWidth })); } catch {}
  }));
  addEventListener('resize', () => place(false));
  document.fonts?.ready.then(() => place(ind.classList.contains('is-animating')));
}

/** Hiện dần các section khi cuộn tới (CSS chỉ áp dụng khi không bật giảm chuyển động) */
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}

/* ---------------- HOME ---------------- */
async function home() {
  renderWeather();
  const grid = document.getElementById('home-places');
  const foodRow = document.getElementById('home-food');
  const itins = document.getElementById('home-itins');
  if (grid) grid.innerHTML = skeletonCards(5);
  if (foodRow) foodRow.innerHTML = skeletonCards(3, false);

  const [places, foods] = await Promise.all([api.getPlaces(), api.getFoods()]);
  if (grid) { grid.innerHTML = places.slice(0, 5).map((p) => placeCard(p)).join(''); bindAddButtons(grid); hydrateImages(grid); }
  if (foodRow) { foodRow.innerHTML = foods.slice(0, 8).map(foodCard).join(''); bindAddButtons(foodRow); hydrateImages(foodRow); }
  if (itins) await renderSamples(itins, true);
}

async function renderWeather() {
  const box = document.getElementById('weather');
  if (!box) return;
  box.innerHTML = `<p class="muted">${t('weather.loading')}</p>`;
  try {
    const [w, a] = await Promise.all([api.getWeather(), api.getAQI().catch(() => null)]);
    const c = w.current;
    const aqi = a?.current?.us_aqi;
    const lab = api.aqiLabel(aqi);
    const days = w.daily.time.slice(1, 5).map((d, i) => {
      const idx = i + 1;
      const dt = new Date(d).toLocaleDateString('vi-VN', { weekday: 'short' });
      return `<div class="day"><b>${dt}</b><span class="glyph">${api.weatherIcon(w.daily.weather_code[idx])}</span><span>${Math.round(w.daily.temperature_2m_min[idx])}° / ${Math.round(w.daily.temperature_2m_max[idx])}°</span><span class="muted">${icon('drop')} ${w.daily.precipitation_probability_max[idx]}%</span></div>`;
    }).join('');
    box.innerHTML = `
      <div class="weather-now">
        <span class="glyph" aria-hidden="true">${api.weatherIcon(c.weather_code, c.is_day)}</span>
        <div>
          <div class="big">${Math.round(c.temperature_2m)}°C</div>
          <div class="weather-meta">
            <span>${t('weather.humidity')}: ${c.relative_humidity_2m}%</span>
            <span>${t('weather.aqi')}: ${aqi != null ? `<span class="aqi ${lab.cls}">${aqi} ${lab.text}</span>` : '?'}</span>
          </div>
        </div>
      </div>
      <div class="weather-days">${days}</div>`;
  } catch {
    box.innerHTML = `<p class="muted">${t('weather.error')}</p>`;
  }
}

/* ---------------- PLACES ---------------- */
/** Lọc theo ô tìm kiếm (không phân biệt dấu); gõ tới đâu lọc tới đó */
function searchable(input, render) {
  if (input && !input.dataset.bound) { input.dataset.bound = '1'; input.addEventListener('input', render); }
  const q = fold(input?.value.trim());
  return (texts) => !q || texts.some((x) => fold(x).includes(q));
}

async function places() {
  const grid = document.getElementById('places-grid');
  const count = document.getElementById('place-count');
  if (!grid.children.length) grid.innerHTML = skeletonCards(6);
  const all = await api.getPlaces();
  const match = searchable(document.getElementById('place-search'), places);
  const list = all.filter((p) => match([p.name?.vi, p.name?.en]));

  count.textContent = t('places.count', { n: list.length });
  grid.innerHTML = list.map((p) => placeCard(p)).join('') || emptyState(t('places.empty'));
  bindAddButtons(grid);
  hydrateImages(grid);
}

/* ---------------- FOOD ---------------- */
async function food() {
  const grid = document.getElementById('food-grid');
  const count = document.getElementById('food-count');
  if (!grid.children.length) grid.innerHTML = skeletonCards(6);
  const foods = await api.getFoods();
  const match = searchable(document.getElementById('food-search'), food);
  const list = foods.filter((f) => match([f.name?.vi, f.name?.en, t('dish.' + f.dish), f.address]));
  count.textContent = t('food.count', { n: list.length });
  grid.innerHTML = list.map(foodCard).join('') || emptyState(t('food.empty'));
  bindAddButtons(grid);
  hydrateImages(grid);
}

/* ---------------- HOTELS ---------------- */
async function hotels() {
  const grid = document.getElementById('hotels-grid');
  grid.innerHTML = skeletonCards(6);
  const all = await api.getHotels();
  grid.innerHTML = all.map(hotelCard).join('') || emptyState(t('hotels.empty'), { ic: 'bed' });
  hydrateImages(grid);
}

/* ---------------- HISTORY ---------------- */
async function history() {
  const tl = document.getElementById('timeline');
  const events = await api.getHistory();
  tl.innerHTML = events.map((e, i) => `
    <li class="tl-item ${i % 2 ? 'right' : 'left'}">
      <div class="tl-year">${e.year}</div>
      <article class="tl-card">
        <h3 class="tl-title"><button type="button" class="tl-toggle" aria-expanded="false" aria-controls="tl-more-${i}">
          <span>${L(e.title)}</span>${icon('chevron', 'tl-chevron')}
        </button></h3>
        <p class="tl-desc">${L(e.desc)}</p>
        <div class="tl-more" id="tl-more-${i}">
          <div class="tl-more-inner">
            ${e.image ? `<img class="tl-img" src="${e.image}" alt="${e.imageAlt || ''}" loading="lazy" width="960" height="540" />` : ''}
            ${e.detail ? `<p>${L(e.detail)}</p>` : ''}
            ${e.fact ? `<p class="tl-fact">${icon('bulb')}<span><b>${t('history.fact')}</b> ${L(e.fact)}</span></p>` : ''}
            <div class="actions">
              ${e.wiki?.vi ? `<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="${api.wikiLink(e.wiki.vi)}">${icon('external')} ${t('history.more')}</a>` : ''}
              <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${api.googleSearch(L(e.title))}">${icon('l-google', 'ic-logo')} ${t('history.google')}</a>
            </div>
          </div>
        </div>
      </article>
    </li>`).join('');
  tl.querySelectorAll('.tl-img').forEach((img) => img.addEventListener('error', () => img.remove(), { once: true }));
  initTimelineCards(tl);
  const io = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && x.target.classList.add('show')), { threshold: 0.2 });
  tl.querySelectorAll('.tl-item').forEach((el) => io.observe(el));
}

/** Ô mốc thời gian mở rộng khi bấm (giữ mở tới khi bấm lại) hoặc khi rê chuột (thiết bị có chuột) */
function initTimelineCards(tl) {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  tl.querySelectorAll('.tl-card').forEach((card) => {
    const btn = card.querySelector('.tl-toggle');
    let pinned = false, timer = 0;
    const set = (open) => { card.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
    // Bấm vào bất cứ đâu trên ô (trừ link trong phần mở rộng): ghim mở / bỏ ghim và đóng
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      clearTimeout(timer);
      pinned = !pinned;
      set(pinned);
    });
    if (canHover) {
      card.addEventListener('mouseenter', () => { clearTimeout(timer); timer = setTimeout(() => set(true), 120); });
      card.addEventListener('mouseleave', () => { clearTimeout(timer); if (!pinned) set(false); });
    }
  });
}

/* ---------------- ITINERARY ---------------- */
async function itinerary() {
  const root = document.getElementById('itinerary');
  if (!root.dataset.bound) {
    root.dataset.bound = '1';
    document.addEventListener('storagechange', (e) => { if (e.detail?.key === KEY_ITIN) safe(renderItinerary); });
  }
  await renderItinerary();
  const samples = document.getElementById('itin-samples');
  if (samples) await renderSamples(samples, false);
}

async function renderItinerary() {
  const root = document.getElementById('itinerary');
  const it = getItinerary();
  const items = await Promise.all(it.days.map((d) => Promise.all(d.map(api.findItem))));
  const allEmpty = items.every((d) => d.every((x) => !x));

  if (allEmpty) {
    root.innerHTML = emptyState(t('itinerary.empty'), { href: 'places.html', label: t('itinerary.emptyCta'), ic: 'map' });
  } else {
    root.innerHTML = it.days.map((ids, di) => {
      const objs = items[di].filter(Boolean);
      const cost = objs.reduce((s, o) => s + (o.ticket || 0) + (o.price?.min || 0), 0);
      const mins = objs.reduce((s, o) => s + (o.duration || 60), 0);
      const pts = objs.filter((o) => o.lat).map((o) => ({ lat: o.lat, lng: o.lng }));
      return `
      <section class="day-block">
        <h2>${t('itinerary.day', { n: di + 1 })}</h2>
        <ol class="day-list" data-day="${di + 1}">
          ${objs.map((o, i) => `<li data-id="${o.id}"><span class="drag" aria-hidden="true">${icon('grip')}</span><span class="n">${i + 1}</span><strong>${L(o.name)}</strong><span class="hrs">${o.hours || ''}</span>
            <button type="button" class="rm" data-rm="${o.id}" data-day="${di + 1}" aria-label="remove">${icon('x')}</button></li>`).join('')}
        </ol>
        <p class="summary"><span>${icon('ticket')} ${t('itinerary.total')}: <b>${formatVND(cost)}</b></span><span>${icon('hourglass')} ${t('itinerary.time')}: <b>${Math.floor(mins / 60)}h${mins % 60 ? String(mins % 60).padStart(2, '0') : ''}</b></span></p>
        ${mins > 480 ? `<p class="warn">${icon('alert')} ${t('itinerary.overpacked')}</p>` : ''}
        ${pts.length ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${api.mapsRoute(pts)}">${icon('map')} ${t('itinerary.route')}</a>` : ''}
      </section>`;
    }).join('') + `<div class="itin-foot"><button type="button" class="btn btn-danger" id="clear-itin">${icon('trash')} ${t('itinerary.clear')}</button></div>`;

    root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => removeFromItinerary(b.dataset.rm, +b.dataset.day)));
    root.querySelector('#clear-itin').addEventListener('click', () => { if (confirm(t('itinerary.confirmClear'))) clearItinerary(); });

    // Kéo-thả bằng SortableJS nếu đã nạp (CDN), không có thì bỏ qua
    if (window.Sortable) {
      root.querySelectorAll('.day-list').forEach((ul) => new Sortable(ul, {
        group: 'itin', animation: 150, handle: '.drag',
        onEnd: () => {
          const days = [...root.querySelectorAll('.day-list')].map((l) => [...l.querySelectorAll('li')].map((li) => li.dataset.id));
          setItinerary({ days });
        },
      }));
    }
  }
}

/** Lịch trình mẫu từ itineraries.json; onHome: bấm "Dùng" thì chuyển sang trang lịch trình */
async function renderSamples(box, onHome) {
  const [its, places, foods] = await Promise.all([api.getItineraries(), api.getPlaces(), api.getFoods()]);
  const names = Object.fromEntries([...places, ...foods].map((x) => [x.id, L(x.name)]));
  box.innerHTML = its.map((it) => sampleCard(it, names)).join('');
  box.querySelectorAll('[data-use-sample]').forEach((b) => b.addEventListener('click', () => {
    const it = its.find((x) => x.id === b.dataset.useSample);
    if (!it) return;
    const current = getItinerary();
    const hasItems = current.days.some((d) => d.length);
    if (hasItems && !confirm(t('itinerary.confirmReplace'))) return;
    setItinerary({ days: it.days.map((d) => [...d.items]) });
    toast(t('itinerary.applied'));
    if (onHome) location.href = 'pages/itinerary.html';
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}
