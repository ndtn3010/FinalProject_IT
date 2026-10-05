// app.js – khởi tạo chung cho mọi trang + logic theo data-page
import { detectLang, loadLang, initLangSwitcher, t, L, formatVND, locale } from './i18n.js';
import * as api from './api.js';
import { placeCard, foodCard, hotelCard, sampleCard, skeletonCards, emptyState, hydrateImages, bindAddButtons, toast, icon } from './render.js';
import { getItinerary, removeFromItinerary, clearItinerary, setItinerary, getTrip, setTrip } from './storage.js';
import { initChatbot } from './chatbot.js';
import { initIntro } from './intro.js';
import { initTripPanel } from './trip.js';

const page = document.body.dataset.page;
const pages = { home, places, food, hotels, history, itinerary };

(async function boot() {
  initLangSwitcher();
  initTheme();
  initMenu();
  initPageTransitions();
  await loadLang(detectLang());
  initIntro();
  initChatbot();
  initTripPanel();
  markActiveNav();
  initNavIndicator();
  initReveal();
  document.querySelectorAll('[data-open-chat]').forEach((b) => b.addEventListener('click', () => document.querySelector('#hg-chat .chat-fab')?.click()));
  if (pages[page]) await safe(pages[page]);
  document.addEventListener('langchange', () => { if (pages[page]) safe(pages[page]); });
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

function initTheme() {
  const root = document.documentElement;
  if (!root.dataset.theme) {
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch {}
    root.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
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
  document.addEventListener('langchange', () => requestAnimationFrame(() => place(true)));
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
      const dt = new Date(d).toLocaleDateString(locale(), { weekday: 'short' });
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
let placeFilter = 'all', userPos = null;
async function places() {
  const grid = document.getElementById('places-grid');
  const filters = document.getElementById('place-filters');
  const count = document.getElementById('place-count');
  if (!grid.children.length) grid.innerHTML = skeletonCards(6);
  const all = await api.getPlaces();

  const types = ['all', ...new Set(all.map((p) => p.type))];
  filters.innerHTML = types.map((ty) => `<button type="button" class="chip ${placeFilter === ty ? 'active' : ''}" data-filter="${ty}">${t('places.' + ty)}</button>`).join('') +
    `<button type="button" class="chip ${userPos ? 'active' : ''}" id="near-me">${icon('locate')} ${t('places.nearme')}</button>`;
  filters.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { placeFilter = b.dataset.filter; places(); }));
  filters.querySelector('#near-me').addEventListener('click', () => {
    if (userPos) { userPos = null; places(); return; }
    if (!navigator.geolocation) { toast(t('places.geoDenied')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }; places(); },
      () => toast(t('places.geoDenied'))
    );
  });

  let list = placeFilter === 'all' ? all : all.filter((p) => p.type === placeFilter);
  const q = (document.getElementById('place-search')?.value || '').trim().toLowerCase();
  if (q) list = list.filter((p) => ['vi', 'en', 'zh'].some((l) => (p.name[l] || '').toLowerCase().includes(q)));
  if (userPos) list = list.map((p) => ({ ...p, _d: api.distanceKm(userPos, p) })).sort((a, b) => a._d - b._d);

  count.textContent = t('places.count', { n: list.length });
  grid.innerHTML = list.map((p) => placeCard(p, { distance: p._d })).join('') || emptyState(t('places.empty'));
  bindAddButtons(grid);
  hydrateImages(grid);

  const search = document.getElementById('place-search');
  if (search && !search.dataset.bound) { search.dataset.bound = '1'; search.addEventListener('input', places); }
}

/* ---------------- FOOD ---------------- */
let foodCat = 'all';
async function food() {
  const grid = document.getElementById('food-grid');
  const count = document.getElementById('food-count');
  if (!grid.children.length) grid.innerHTML = skeletonCards(6);
  const foods = await api.getFoods();
  const list = foodCat === 'all' ? foods
    : foodCat === 'vegetarian' ? foods.filter((f) => f.diet?.includes('vegetarian'))
    : foods.filter((f) => f.cat === foodCat);
  count.textContent = t('food.count', { n: list.length });
  grid.innerHTML = list.map(foodCard).join('') || emptyState(t('food.empty'));
  bindAddButtons(grid);
  hydrateImages(grid);
  document.querySelectorAll('[data-cat]').forEach((b) => {
    b.classList.toggle('active', b.dataset.cat === foodCat);
    if (!b.dataset.bound) { b.dataset.bound = '1'; b.addEventListener('click', () => { foodCat = b.dataset.cat; food(); }); }
  });
}

/* ---------------- HOTELS ---------------- */
const hotelFilter = { area: 'all', budget: 'all', type: 'all' };
const AREAS = ['all', 'oldquarter', 'hoankiem', 'westlake', 'badinh', 'noibai'];
const BUDGETS = ['all', 'budget', 'mid', 'luxury'];
const TYPES = ['all', 'hotel', 'hostel', 'homestay'];

/** Ngày mặc định khi My Trip chưa có: mai -> 3 ngày sau (không lưu cho tới khi người dùng đổi) */
function defaultTrip() {
  const trip = getTrip();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (!api.nightsBetween(trip.start, trip.end)) {
    const a = new Date(); a.setDate(a.getDate() + 1);
    const b = new Date(a); b.setDate(b.getDate() + 2);
    return { ...trip, start: iso(a), end: iso(b) };
  }
  return trip;
}

async function hotels() {
  const grid = document.getElementById('hotels-grid');
  const count = document.getElementById('hotel-count');
  const form = document.getElementById('trip-bar');
  const ci = form.checkin, co = form.checkout, gu = form.guests;
  if (!grid.children.length) grid.innerHTML = skeletonCards(6);

  // Trip bar: điền từ My Trip, thay đổi -> lưu lại và render lại link
  if (!form.dataset.bound) {
    form.dataset.bound = '1';
    const trip = defaultTrip();
    ci.value = trip.start; co.value = trip.end; gu.value = String(trip.guests || 2);
    const today = new Date().toISOString().slice(0, 10);
    ci.min = today;
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('change', () => {
      if (co.value <= ci.value) { const d = new Date(ci.value); d.setDate(d.getDate() + 1); co.value = d.toISOString().slice(0, 10); }
      co.min = ci.value;
      setTrip({ start: ci.value, end: co.value, guests: +gu.value });
      toast(t('hotels.saved'));
      hotels();
    });
  }
  const trip = { start: ci.value, end: co.value, guests: +gu.value };
  document.getElementById('trip-nights').textContent = t('hotels.nights', { n: api.nightsBetween(trip.start, trip.end) });

  // Chips lọc
  const chips = (id, key, values, prefix) => {
    const box = document.getElementById(id);
    box.innerHTML = values.map((v) => `<button type="button" class="chip ${hotelFilter[key] === v ? 'active' : ''}" data-v="${v}">${t(prefix + v)}</button>`).join('');
    box.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { hotelFilter[key] = b.dataset.v; hotels(); }));
  };
  chips('hotel-area', 'area', AREAS, 'hotels.area.');
  chips('hotel-budget', 'budget', BUDGETS, 'hotels.budget.');
  chips('hotel-type', 'type', TYPES, 'hotels.type.');

  const all = await api.getHotels();
  const list = all.filter((h) =>
    (hotelFilter.area === 'all' || h.area === hotelFilter.area) &&
    (hotelFilter.budget === 'all' || h.budget === hotelFilter.budget) &&
    (hotelFilter.type === 'all' || h.type === hotelFilter.type));
  count.textContent = t('hotels.count', { n: list.length });
  grid.innerHTML = list.map((h) => hotelCard(h, trip)).join('') || emptyState(t('hotels.empty'), { ic: 'bed' });
  hydrateImages(grid);
}

/* ---------------- HISTORY ---------------- */
async function history() {
  const tl = document.getElementById('timeline');
  const events = await api.getHistory();
  tl.innerHTML = events.map((e, i) => `
    <li class="tl-item ${i % 2 ? 'right' : 'left'}">
      <div class="tl-year">${e.year}</div>
      <div class="tl-card"><h3>${L(e.title)}</h3><p>${L(e.desc)}</p></div>
    </li>`).join('');
  const io = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && x.target.classList.add('show')), { threshold: 0.2 });
  tl.querySelectorAll('.tl-item').forEach((el) => io.observe(el));
}

/* ---------------- ITINERARY ---------------- */
async function itinerary() {
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

    root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { removeFromItinerary(b.dataset.rm, +b.dataset.day); itinerary(); }));
    root.querySelector('#clear-itin').addEventListener('click', () => { if (confirm(t('itinerary.confirmClear'))) { clearItinerary(); itinerary(); } });

    // Kéo-thả bằng SortableJS nếu đã nạp (CDN), không có thì bỏ qua
    if (window.Sortable) {
      root.querySelectorAll('.day-list').forEach((ul) => new Sortable(ul, {
        group: 'itin', animation: 150, handle: '.drag',
        onEnd: () => {
          const days = [...root.querySelectorAll('.day-list')].map((l) => [...l.querySelectorAll('li')].map((li) => li.dataset.id));
          setItinerary({ days }); itinerary();
        },
      }));
    }
  }

  const samples = document.getElementById('itin-samples');
  if (samples) await renderSamples(samples, false);
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
    else { itinerary(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }));
}
