// places.js – trang Địa điểm: danh sách và ô tìm kiếm
import { getPlaces } from './api.js';
import { matchesSearch } from './utils.js';
import { placeCard, skeletonCards, emptyState, bindAddButtons, loadMissingImages } from './render.js';

export async function initPlaces() {
  const grid = document.getElementById('places-grid');
  const count = document.getElementById('place-count');
  const searchBox = document.getElementById('place-search');

  grid.innerHTML = skeletonCards(6);
  const places = await getPlaces();

  function showResults() {
    const keyword = searchBox.value.trim();
    const results = places.filter((place) => matchesSearch(place.name, keyword));

    count.textContent = results.length + ' địa điểm';
    if (results.length === 0) {
      grid.innerHTML = emptyState('Không tìm thấy địa điểm phù hợp. Thử từ khoá khác.');
      return;
    }
    grid.innerHTML = results.map(placeCard).join('');
    bindAddButtons(grid);
    loadMissingImages(grid);
  }

  showResults();
  // Gõ tới đâu lọc tới đó
  searchBox.addEventListener('input', showResults);
}
