// app.js – chạy trên mọi trang: menu, hiệu ứng chuyển trang, cửa sổ lịch trình,
// rồi gọi phần riêng của trang đang mở (dựa vào <body data-page="...">)
import { initTripPanel } from './trip.js';
import { showToast } from './render.js';
import { initHome } from './home.js';
import { initPlaces } from './places.js';
import { initFood } from './food.js';
import { initHotels } from './hotels.js';
import { initHistory } from './history.js';
import { initItinerary } from './itinerary.js';

// Tên trang -> hàm khởi tạo trang đó
const PAGES = {
  home: initHome,
  places: initPlaces,
  food: initFood,
  hotels: initHotels,
  history: initHistory,
  itinerary: initItinerary,
};

const currentPage = document.body.dataset.page;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Nội dung trang chạy trước, các hiệu ứng trang trí chạy sau
startPage();
initTripPanel();
initMenu();
markActiveTab();
initPageTransitions();
initTabHighlight();
initReveal();

// Chạy phần riêng của trang. Có lỗi thì báo nhẹ, không để trang trắng.
async function startPage() {
  const init = PAGES[currentPage];
  if (!init) return;
  try {
    await init();
  } catch (error) {
    console.error(error);
    showToast('Có lỗi khi tải dữ liệu, hãy thử tải lại trang.');
  }
}

/* ---------- Menu ---------- */

// Tô màu tab của trang đang mở
function markActiveTab() {
  document.querySelectorAll('.nav a').forEach((link) => {
    if (link.dataset.page === currentPage) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

// Nút ba gạch mở / đóng menu trên điện thoại
function initMenu() {
  const header = document.querySelector('.header');
  const button = document.querySelector('[data-menu-toggle]');

  function setOpen(open) {
    header.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
  header.querySelectorAll('.nav a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
}

/* ---------- Hiệu ứng ---------- */

// Bấm link sang trang khác trong web: làm mờ nội dung trong 0,15 giây rồi mới chuyển trang
function initPageTransitions() {
  if (reduceMotion) return;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank') return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;

    const url = new URL(link.href, location.href);
    const isOtherSite = url.origin !== location.origin;
    const isSamePageAnchor = url.pathname === location.pathname && url.hash;
    if (isOtherSite || isSamePageAnchor) return;

    event.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(() => { location.href = url.href; }, 150);
  });

  // Quay lại bằng nút Back thì bỏ trạng thái mờ
  window.addEventListener('pageshow', () => document.body.classList.remove('is-leaving'));
}

// Ô nền đỏ nhạt trên menu trượt từ tab cũ sang tab mới.
// Lúc bấm tab: ghi nhớ vị trí ô hiện tại. Trang mới mở ra: đặt ô ở vị trí cũ rồi cho trượt tới tab mới.
function initTabHighlight() {
  const nav = document.querySelector('.nav');
  const highlight = nav.querySelector('.nav-indicator');
  const MEMORY_KEY = 'hg.nav.from';

  // Vị trí và kích thước của một tab, tính so với menu
  function positionOf(tab) {
    const tabBox = tab.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    return { x: tabBox.left - navBox.left, y: tabBox.top - navBox.top, width: tabBox.width, height: tabBox.height };
  }

  function moveTo(position, animate) {
    highlight.classList.toggle('is-animating', animate);
    highlight.style.transform = `translate(${position.x}px, ${position.y}px)`;
    highlight.style.width = position.width + 'px';
    highlight.style.height = position.height + 'px';
    highlight.classList.add('is-ready');
  }

  function moveToActiveTab(animate) {
    const activeTab = nav.querySelector('a.active');
    const isMobileMenu = getComputedStyle(highlight).display === 'none';
    if (!activeTab || isMobileMenu) return;
    moveTo(positionOf(activeTab), animate);
  }

  // Trang trước có ghi nhớ vị trí không? (đọc lỗi thì coi như không có)
  let previous = null;
  try {
    previous = JSON.parse(sessionStorage.getItem(MEMORY_KEY));
    sessionStorage.removeItem(MEMORY_KEY);
  } catch {
    previous = null;
  }

  if (previous && !reduceMotion && previous.screenWidth === window.innerWidth) {
    moveTo(previous, false);
    // chờ trình duyệt vẽ xong vị trí cũ rồi mới trượt sang tab mới
    requestAnimationFrame(() => requestAnimationFrame(() => moveToActiveTab(true)));
  } else {
    moveToActiveTab(false);
  }

  nav.querySelectorAll('a').forEach((tab) => {
    tab.addEventListener('click', () => {
      const activeTab = nav.querySelector('a.active');
      if (!activeTab) return;
      const position = positionOf(activeTab);
      position.screenWidth = window.innerWidth;
      try {
        sessionStorage.setItem(MEMORY_KEY, JSON.stringify(position));
      } catch {
        // không lưu được thì trang sau chỉ không có hiệu ứng trượt
      }
    });
  });

  window.addEventListener('resize', () => moveToActiveTab(false));
  // Font chữ tải xong có thể làm tab rộng ra một chút; đang trượt thì trượt tiếp tới vị trí mới
  document.fonts.ready.then(() => moveToActiveTab(highlight.classList.contains('is-animating')));
}

// Các khối có class "reveal" hiện dần lên khi cuộn tới
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach((section) => observer.observe(section));
}
