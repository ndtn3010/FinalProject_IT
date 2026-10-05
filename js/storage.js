// storage.js – lịch trình, yêu thích, My Trip (localStorage)
const KEY_ITIN = 'hg.itinerary.v1';
const KEY_FAV = 'hg.favourites.v1';
const KEY_TRIP = 'hg.trip.v1';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  document.dispatchEvent(new CustomEvent('storagechange', { detail: { key } }));
}

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

/* ---- Favourites ---- */
export function getFavourites() { return read(KEY_FAV, []); }
export function toggleFavourite(id) {
  const f = getFavourites();
  const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1); else f.push(id);
  write(KEY_FAV, f);
  return i < 0;
}

/* ---- My Trip context ---- */
export function getTrip() {
  return read(KEY_TRIP, { start: '', end: '', guests: 2, budget: 'mid', interests: [] });
}
export function setTrip(patch) { write(KEY_TRIP, { ...getTrip(), ...patch }); }
