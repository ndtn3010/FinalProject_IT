// itinerary.js – trang Lịch trình: danh sách theo ngày, chi phí, thời gian, kéo thả, lịch trình mẫu
import { getItineraries, getPlaces, getFoods, findItem, mapsRoute } from './api.js';
import { getItinerary, setItinerary, removeFromItinerary, clearItinerary } from './storage.js';
import { formatVND, escapeHtml } from './utils.js';
import { sampleCard, emptyState, icon, showToast } from './render.js';

export async function initItinerary() {
  await showItinerary();
  // Lịch trình đổi ở đâu (cửa sổ nổi, tab khác…) thì trang này vẽ lại
  document.addEventListener('storagechange', showItinerary);

  await showSamples(document.getElementById('itin-samples'), false);
}

async function showItinerary() {
  const root = document.getElementById('itinerary');
  const itinerary = getItinerary();

  // Đổi danh sách mã thành thông tin đầy đủ của từng điểm
  const days = [];
  for (const ids of itinerary.days) {
    const items = [];
    for (const id of ids) {
      const item = await findItem(id);
      if (item) items.push(item);
    }
    days.push(items);
  }

  const isEmpty = days.every((items) => items.length === 0);
  if (isEmpty) {
    root.innerHTML = emptyState(
      'Chưa có địa điểm nào. Thêm từ trang Địa điểm, Ẩm thực hoặc chọn lịch trình mẫu bên dưới.',
      { href: 'places.html', label: 'Xem địa điểm' },
      'map');
    return;
  }

  root.innerHTML = days.map(dayBlock).join('')
    + `<div class="itin-foot"><button type="button" class="btn btn-danger" id="clear-itin">${icon('trash')} Xoá tất cả</button></div>`;

  // Nút X xoá một điểm
  root.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => removeFromItinerary(button.dataset.remove, Number(button.dataset.day)));
  });

  root.querySelector('#clear-itin').addEventListener('click', () => {
    if (confirm('Xoá toàn bộ lịch trình?')) clearItinerary();
  });

  enableDragAndDrop(root);
}

// HTML cho một ngày: danh sách điểm, tổng chi phí, tổng thời gian, cảnh báo, link tuyến đường
function dayBlock(items, index) {
  const dayNumber = index + 1;

  let cost = 0;       // giá vé địa điểm + giá thấp nhất của quán ăn
  let minutes = 0;    // thời gian tham quan; quán ăn không ghi thì tính 60 phút
  for (const item of items) {
    cost += item.ticket || 0;
    if (item.price) cost += item.price.min;
    minutes += item.duration || 60;
  }
  const hours = Math.floor(minutes / 60);
  const extraMinutes = minutes % 60;
  const timeText = extraMinutes > 0 ? `${hours}h${String(extraMinutes).padStart(2, '0')}` : `${hours}h`;

  const rows = items.map((item, i) => `
    <li data-id="${escapeHtml(item.id)}">
      <span class="drag" aria-hidden="true">${icon('grip')}</span>
      <span class="n">${i + 1}</span>
      <strong>${escapeHtml(item.name)}</strong>
      <span class="hrs">${escapeHtml(item.hours || '')}</span>
      <button type="button" class="rm" data-remove="${escapeHtml(item.id)}" data-day="${dayNumber}" aria-label="Xoá">${icon('x')}</button>
    </li>`).join('');

  // Quá 8 tiếng (480 phút) thì nhắc là ngày này hơi dày
  const warning = minutes > 480
    ? `<p class="warn">${icon('alert')} Ngày này hơi dày (trên 8 giờ). Cân nhắc bớt địa điểm.</p>`
    : '';

  const points = items.filter((item) => item.lat).map((item) => ({ lat: item.lat, lng: item.lng }));
  const routeLink = points.length > 0
    ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${mapsRoute(points)}">${icon('map')} Mở tuyến đường trên Google Maps</a>`
    : '';

  return `
    <section class="day-block">
      <h2>Ngày ${dayNumber}</h2>
      <ol class="day-list">${rows}</ol>
      <p class="summary">
        <span>${icon('ticket')} Chi phí vé ước tính: <b>${formatVND(cost)}</b></span>
        <span>${icon('hourglass')} Thời gian tham quan: <b>${timeText}</b></span>
      </p>
      ${warning}
      ${routeLink}
    </section>`;
}

// Kéo thả để đổi thứ tự (thư viện SortableJS). Không tải được thư viện thì bỏ qua.
function enableDragAndDrop(root) {
  if (!window.Sortable) return;

  root.querySelectorAll('.day-list').forEach((list) => {
    new window.Sortable(list, {
      group: 'itinerary',   // cho kéo điểm sang ngày khác
      handle: '.drag',      // chỉ kéo được khi nắm biểu tượng sáu chấm
      animation: 150,
      onEnd: () => {
        // Đọc lại thứ tự mới trên giao diện rồi lưu
        const days = [];
        root.querySelectorAll('.day-list').forEach((dayList) => {
          const ids = [];
          dayList.querySelectorAll('li').forEach((row) => ids.push(row.dataset.id));
          days.push(ids);
        });
        setItinerary({ days });
      },
    });
  });
}

/* ---------- Lịch trình mẫu (dùng ở cả trang chủ) ---------- */

export async function showSamples(box, isHomePage) {
  const samples = await getItineraries();

  // Bảng tra mã -> tên để hiện tên các điểm trong lịch trình mẫu
  const names = {};
  for (const item of await getPlaces()) names[item.id] = item.name;
  for (const item of await getFoods()) names[item.id] = item.name;

  box.innerHTML = samples.map((sample) => sampleCard(sample, names)).join('');

  box.querySelectorAll('[data-use-sample]').forEach((button) => {
    button.addEventListener('click', () => {
      const sample = samples.find((s) => s.id === button.dataset.useSample);

      // Đang có lịch trình thì hỏi trước khi thay
      const hasItems = getItinerary().days.some((day) => day.length > 0);
      if (hasItems && !confirm('Thay lịch trình hiện tại bằng lịch trình mẫu này?')) return;

      setItinerary({ days: sample.days.map((day) => [...day.items]) });
      showToast('Đã nạp lịch trình mẫu');

      if (isHomePage) location.href = 'pages/itinerary.html';
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}
