// history.js – trang Lịch sử: dòng thời gian và cửa sổ chi tiết từng mốc
import { getHistory } from './api.js';
import { escapeHtml } from './utils.js';
import { icon } from './render.js';

let events = [];         // các mốc lịch sử trong data/history.json
let currentIndex = 0;    // mốc đang mở trong cửa sổ chi tiết

export async function initHistory() {
  events = await getHistory();

  // Mỗi mốc là một ô; ô chẵn bên trái, ô lẻ bên phải trục thời gian
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = events.map((event, index) => {
    const side = index % 2 === 0 ? 'left' : 'right';
    return `
    <li class="tl-item ${side}">
      <div class="tl-year">${escapeHtml(event.year)}</div>
      <article class="tl-card" data-index="${index}">
        <h3 class="tl-title"><button type="button" class="tl-open" aria-haspopup="dialog">${escapeHtml(event.title)}</button></h3>
        <p>${escapeHtml(event.desc)}</p>
        <span class="tl-hint">Xem chi tiết${icon('arrow')}</span>
      </article>
    </li>`;
  }).join('');

  // Bấm vào ô thì mở cửa sổ chi tiết của mốc đó
  timeline.querySelectorAll('.tl-card').forEach((card) => {
    card.addEventListener('click', () => openDetail(Number(card.dataset.index)));
  });

  setUpDialog();
  revealOnScroll(timeline);
}

/* ---------- Cửa sổ chi tiết (thẻ <dialog> có sẵn của HTML) ---------- */

function setUpDialog() {
  const dialog = document.getElementById('tl-dialog');

  // Đóng bằng nút X
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());

  // Đóng khi bấm vào nền tối bên ngoài khung
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  // Nút "Mốc trước" (-1) và "Mốc sau" (+1)
  dialog.querySelectorAll('[data-step]').forEach((button) => {
    button.addEventListener('click', () => openDetail(currentIndex + Number(button.dataset.step)));
  });
  // Phím Esc thì thẻ <dialog> tự đóng, không cần viết thêm
}

function openDetail(index) {
  const dialog = document.getElementById('tl-dialog');
  const event = events[index];
  currentIndex = index;

  dialog.querySelector('.modal-body').innerHTML = `
    ${photo(event)}
    <p class="modal-year">${escapeHtml(event.year)}</p>
    <h2 id="tl-dialog-title">${escapeHtml(event.title)}</h2>
    <dl class="modal-facts">
      <div><dt>Thời gian</dt><dd>${escapeHtml(event.when)}</dd></div>
      <div><dt>Nhân vật</dt><dd>${escapeHtml(event.who)}</dd></div>
      <div><dt>Địa điểm</dt><dd>${escapeHtml(event.where)}</dd></div>
    </dl>
    ${paragraphs(event.detail)}
    <p class="tl-fact">${icon('bulb')}<span><b>Có thể bạn chưa biết:</b> ${escapeHtml(event.fact)}</span></p>`;

  // Ảnh lỗi thì bỏ khung ảnh đi
  const image = dialog.querySelector('.modal-media img');
  if (image) image.addEventListener('error', () => image.parentElement.remove());

  dialog.querySelector('.modal-body').scrollTop = 0;
  dialog.querySelector('[data-step="-1"]').disabled = index === 0;
  dialog.querySelector('[data-step="1"]').disabled = index === events.length - 1;

  // Mở dạng popup: trang phía sau bị khoá cho tới khi đóng
  if (!dialog.open) dialog.showModal();
}

function photo(event) {
  if (!event.image) return '';
  return `
    <figure class="modal-media">
      <img src="${escapeHtml(event.image)}" alt="${escapeHtml(event.imageAlt)}" width="960" height="540" />
      <figcaption>${escapeHtml(event.imageAlt)}. Ảnh: Wikimedia Commons</figcaption>
    </figure>`;
}

// Phần chi tiết trong dữ liệu: các đoạn cách nhau bằng một dòng trống
function paragraphs(text) {
  return text.split('\n\n').map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

// Các ô hiện dần lên khi cuộn tới
function revealOnScroll(timeline) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('show');
    });
  }, { threshold: 0.2 });
  timeline.querySelectorAll('.tl-item').forEach((item) => observer.observe(item));
}
