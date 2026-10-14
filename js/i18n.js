// i18n.js – chuỗi giao diện tiếng Việt (i18n/vi.json)
let dict = {};

export async function loadStrings() {
  try {
    const res = await fetch(`${baseUrl()}i18n/vi.json`);
    dict = await res.json();
  } catch { dict = {}; }
  applyDom();
}

export function t(key, vars = {}) {
  let s = dict[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

/** true nếu key có trong từ điển */
export function has(key) {
  return dict[key] != null;
}

/** Lấy text tiếng Việt từ dữ liệu: object {vi,...} hoặc chuỗi */
export function L(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj.vi || obj.en || '';
}

export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
}

export function formatVND(n) {
  if (n == null) return '';
  return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

/** Chuẩn hoá để tìm kiếm không dấu: "Hồ Gươm" ~ "ho guom" */
export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
}

/** Thư mục gốc của site (để chạy được cả ở /repo-name/ trên GitHub Pages và ở /pages/xxx.html) */
export function baseUrl() {
  const b = document.querySelector('base[href]');
  if (b) return b.getAttribute('href');
  return document.body.dataset.base || './';
}
