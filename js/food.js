// food.js – trang Ẩm thực: danh sách quán và ô tìm kiếm
import { getFoods } from './api.js';
import { matchesSearch } from './utils.js';
import { DISH_NAMES } from './labels.js';
import { foodCard, skeletonCards, emptyState, bindAddButtons, loadMissingImages } from './render.js';

export async function initFood() {
  const grid = document.getElementById('food-grid');
  const count = document.getElementById('food-count');
  const searchBox = document.getElementById('food-search');

  grid.innerHTML = skeletonCards(6);
  const foods = await getFoods();

  function showResults() {
    const keyword = searchBox.value.trim();
    // Tìm theo tên quán, tên món hoặc địa chỉ
    const results = foods.filter((food) =>
      matchesSearch(food.name, keyword)
      || matchesSearch(DISH_NAMES[food.dish], keyword)
      || matchesSearch(food.address, keyword));

    count.textContent = results.length + ' quán';
    if (results.length === 0) {
      grid.innerHTML = emptyState('Không tìm thấy quán phù hợp. Thử từ khoá khác.');
      return;
    }
    grid.innerHTML = results.map(foodCard).join('');
    bindAddButtons(grid);
    loadMissingImages(grid);
  }

  showResults();
  searchBox.addEventListener('input', showResults);
}
