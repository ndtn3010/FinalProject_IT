// utils.js – các hàm nhỏ dùng ở nhiều nơi

// Định dạng tiền Việt: 70000 -> "70.000 ₫"
export function formatVND(amount) {
  if (amount == null) return '';
  return amount.toLocaleString('vi-VN') + ' ₫';
}

// Bỏ dấu tiếng Việt để tìm kiếm: "Hồ Hoàn Kiếm" -> "ho hoan kiem"
export function removeAccents(text) {
  return String(text || '')
    .normalize('NFD')                  // tách chữ và dấu: "ồ" -> "o" + dấu mũ + dấu huyền
    .replace(/[\u0300-\u036f]/g, '')   // xoá các dấu vừa tách ra
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Từ khoá có nằm trong chữ không (không phân biệt dấu, hoa thường)
export function matchesSearch(text, keyword) {
  return removeAccents(text).includes(removeAccents(keyword));
}

// Đổi các ký tự đặc biệt của HTML thành mã an toàn, để chữ trong dữ liệu không bị hiểu nhầm thành thẻ HTML
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Đường dẫn tới thư mục gốc của web: "./" ở trang chủ, "../" ở các trang trong thư mục pages/
export function baseUrl() {
  return document.body.dataset.base || './';
}

// Gắn mã phiên bản vào đường dẫn file (xem tools/build-pages.mjs) để trình duyệt không dùng bản cũ trong cache
export function withVersion(url) {
  const meta = document.querySelector('meta[name="hg-version"]');
  if (!meta) return url;
  return url + '?v=' + meta.content;
}
