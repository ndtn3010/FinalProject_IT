// storage.js – lưu lịch trình trong bộ nhớ của trình duyệt (localStorage)
//
// Lịch trình có dạng: { days: [ ['hoan-kiem-lake', 'cafe-giang'], ['west-lake'] ] }
// mỗi ngày là một danh sách mã (id) địa điểm hoặc quán ăn.

export const ITINERARY_KEY = 'hg.itinerary.v1';

function emptyItinerary() {
  return { days: [[]] };
}

export function getItinerary() {
  try {
    const saved = JSON.parse(localStorage.getItem(ITINERARY_KEY));
    if (saved && Array.isArray(saved.days) && saved.days.length > 0) return saved;
  } catch {
    // dữ liệu hỏng thì coi như chưa có gì
  }
  return emptyItinerary();
}

// Lưu lại rồi báo cho cả trang biết lịch trình vừa đổi (sự kiện "storagechange")
export function setItinerary(itinerary) {
  try {
    localStorage.setItem(ITINERARY_KEY, JSON.stringify(itinerary));
  } catch {
    // trình duyệt chặn lưu (ví dụ chế độ ẩn danh) thì bỏ qua
  }
  document.dispatchEvent(new CustomEvent('storagechange'));
}

export function addToItinerary(id, dayNumber = 1) {
  const itinerary = getItinerary();
  while (itinerary.days.length < dayNumber) itinerary.days.push([]);

  const day = itinerary.days[dayNumber - 1];
  if (!day.includes(id)) day.push(id);
  setItinerary(itinerary);
}

export function removeFromItinerary(id, dayNumber) {
  const itinerary = getItinerary();
  const day = itinerary.days[dayNumber - 1] || [];
  itinerary.days[dayNumber - 1] = day.filter((itemId) => itemId !== id);
  setItinerary(itinerary);
}

export function clearItinerary() {
  setItinerary(emptyItinerary());
}

export function isInItinerary(id) {
  return getItinerary().days.some((day) => day.includes(id));
}

// Lịch trình cũng có thể đổi ở một tab khác, hoặc ở trang khác rồi người dùng bấm Back.
// Hai trường hợp này cũng phát "storagechange" để giao diện vẽ lại theo dữ liệu mới.
window.addEventListener('storage', (event) => {
  if (event.key === ITINERARY_KEY) document.dispatchEvent(new CustomEvent('storagechange'));
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) document.dispatchEvent(new CustomEvent('storagechange'));
});
