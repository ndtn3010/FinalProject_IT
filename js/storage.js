// storage.js – lịch trình (localStorage)
export const KEY_ITIN = 'hg.itinerary.v1';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  document.dispatchEvent(new CustomEvent('storagechange', { detail: { key } }));
}

// Lịch trình có thể đổi ở tab khác, hoặc ở trang khác rồi bấm Back (trang cũ lấy lại từ bfcache)
// -> báo cho giao diện vẽ lại theo dữ liệu mới
addEventListener('storage', (e) => {
  if (e.key == null || e.key.startsWith('hg.')) document.dispatchEvent(new CustomEvent('storagechange', { detail: { key: e.key } }));
});
addEventListener('pageshow', (e) => {
  if (e.persisted) document.dispatchEvent(new CustomEvent('storagechange', { detail: { key: KEY_ITIN } }));
});

/* ---- Itinerary: { days: [ [id, id], [id] ] } ---- */
export function getItinerary() {
  const it = read(KEY_ITIN, { days: [[]] });
  if (!Array.isArray(it.days) || !it.days.length) it.days = [[]];
  return it;
}
export function addToItinerary(id, day = 1) {
  const it = getItinerary();
  while (it.days.length < day) it.days.push([]);
  const list = it.days[day - 1];
  if (!list.includes(id)) list.push(id);
  write(KEY_ITIN, it);
  return it;
}
export function removeFromItinerary(id, day) {
  const it = getItinerary();
  it.days[day - 1] = (it.days[day - 1] || []).filter((x) => x !== id);
  write(KEY_ITIN, it);
  return it;
}
export function setItinerary(it) { write(KEY_ITIN, it); }
export function clearItinerary() { write(KEY_ITIN, { days: [[]] }); }
export function isInItinerary(id) { return getItinerary().days.some((d) => d.includes(id)); }

