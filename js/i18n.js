// i18n.js – đa ngôn ngữ vi / en / zh
const SUPPORTED = ['vi', 'en', 'zh'];
const dict = {};
let current = 'vi';

export function detectLang() {
  try {
    const saved = localStorage.getItem('lang');
    if (SUPPORTED.includes(saved)) return saved;
  } catch {}
  const nav = (navigator.language || 'vi').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('en')) return 'en';
  return 'vi';
}

export async function loadLang(lang) {
  if (!dict[lang]) {
    const res = await fetch(`${baseUrl()}i18n/${lang}.json`);
    dict[lang] = await res.json();
  }
  current = lang;
  try { localStorage.setItem('lang', lang); } catch {}
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  applyDom();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export function t(key, vars = {}) {
  let s = dict[current]?.[key] ?? dict.vi?.[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

/** true nếu key có trong từ điển hiện tại (hoặc vi) */
export function has(key) {
  return (dict[current]?.[key] ?? dict.vi?.[key]) != null;
}

export function getLang() { return current; }

/** Mã locale cho Intl / toLocaleDateString */
export function locale() {
  return current === 'zh' ? 'zh-CN' : current === 'en' ? 'en-GB' : 'vi-VN';
}

/** Lấy text đúng ngôn ngữ từ object {vi,en,zh} */
export function L(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[current] || obj.vi || obj.en || '';
}

export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => { el.alt = t(el.dataset.i18nAlt); });
  root.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === current);
    btn.setAttribute('aria-pressed', btn.dataset.lang === current ? 'true' : 'false');
  });
}

export function formatVND(n) {
  if (n == null) return '';
  if (current === 'vi') return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
  if (current === 'zh') return new Intl.NumberFormat('zh-CN').format(n) + ' 越南盾';
  return new Intl.NumberFormat('en-US').format(n) + ' VND';
}

/** Thư mục gốc của site (để chạy được cả ở /repo-name/ trên GitHub Pages và ở /pages/xxx.html) */
export function baseUrl() {
  const b = document.querySelector('base[href]');
  if (b) return b.getAttribute('href');
  return document.body.dataset.base || './';
}

export function initLangSwitcher() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => loadLang(btn.dataset.lang));
  });
}
