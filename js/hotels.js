// hotels.js – trang Khách sạn: chỉ liệt kê
import { getHotels } from './api.js';
import { hotelCard, skeletonCards, loadMissingImages } from './render.js';

export async function initHotels() {
  const grid = document.getElementById('hotels-grid');
  grid.innerHTML = skeletonCards(6);

  const hotels = await getHotels();
  grid.innerHTML = hotels.map(hotelCard).join('');
  loadMissingImages(grid);
}
