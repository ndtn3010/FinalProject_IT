// chatbot.js – widget chatbot LLM qua Cloudflare Worker (streaming SSE) + fallback rule-based
import { t, L, getLang, formatVND, applyDom } from './i18n.js';
import { getPlaces, getFoods, getWeather, weatherIcon, findItem } from './api.js';
import { addToItinerary } from './storage.js';
import { miniCard, bindAddButtons, toast } from './render.js';

// ==== CẤU HÌNH: đổi thành URL Worker sau khi deploy (vd https://hanoi-guide-chatbot.<user>.workers.dev) ====
export const CHAT_ENDPOINT = window.HG_CHAT_ENDPOINT || '';

const ACTION_TAG = '@@ACTIONS@@';
const history = []; // {role, content}

export function initChatbot() {
  const root = document.createElement('div');
  root.id = 'hg-chat';
  root.innerHTML = `
    <button type="button" class="chat-fab" data-i18n-aria="chat.open" aria-label="Chat" aria-expanded="false"><svg class="ic" aria-hidden="true"><use href="#i-chat"/></svg></button>
    <section class="chat-panel" hidden aria-label="Chatbot">
      <header>
        <span><svg class="ic" aria-hidden="true"><use href="#i-chat"/></svg><span data-i18n="chat.title"></span></span>
        <button type="button" class="chat-close" aria-label="Close"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>
      </header>
      <div class="chat-log" role="log" aria-live="polite"></div>
      <div class="chat-chips"></div>
      <form class="chat-form">
        <input type="text" autocomplete="off" maxlength="500" data-i18n-placeholder="chat.placeholder" />
        <button type="submit" class="btn btn-primary" data-i18n-aria="chat.send" aria-label="Send"><svg class="ic" aria-hidden="true"><use href="#i-send"/></svg></button>
      </form>
    </section>`;
  document.body.appendChild(root);
  applyDom(root);

  const panel = root.querySelector('.chat-panel');
  const log = root.querySelector('.chat-log');
  const form = root.querySelector('.chat-form');
  const input = form.querySelector('input');
  const chips = root.querySelector('.chat-chips');

  const fab = root.querySelector('.chat-fab');
  fab.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    fab.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { document.dispatchEvent(new CustomEvent('hg:panel', { detail: 'chat' })); if (!log.children.length) welcome(); input.focus(); }
  });
  document.addEventListener('hg:panel', (e) => { if (e.detail !== 'chat') { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); } });
  root.querySelector('.chat-close').addEventListener('click', () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); });
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) { input.value = ''; ask(q); } });

  function renderChips() {
    chips.innerHTML = ['chat.q1', 'chat.q2', 'chat.q3', 'chat.q4']
      .map((k) => `<button type="button" class="chip">${t(k)}</button>`).join('');
    chips.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => ask(c.textContent)));
  }
  function welcome() { bubble('bot', t('chat.welcome')); renderChips(); }
  document.addEventListener('langchange', () => { renderChips(); });
  renderChips();

  function bubble(role, html) {
    const el = document.createElement('div');
    el.className = `msg msg-${role}`;
    el.innerHTML = html;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function ask(q) {
    bubble('user', escapeHtml(q));
    history.push({ role: 'user', content: q });
    const el = bubble('bot', '<span class="typing">…</span>');
    form.querySelector('button').disabled = true;
    try {
      const full = CHAT_ENDPOINT ? await streamLLM(el) : await ruleBased(q, el);
      const { text, actions } = splitActions(full);
      el.innerHTML = renderMarkdown(text);
      history.push({ role: 'assistant', content: text });
      await runActions(actions, el);
    } catch (err) {
      console.error(err);
      // Worker lỗi -> fallback rule-based để demo không chết
      try {
        const full = await ruleBased(q, el);
        const { text, actions } = splitActions(full);
        el.innerHTML = renderMarkdown(text);
        await runActions(actions, el);
      } catch { el.textContent = t('chat.error'); }
    } finally {
      form.querySelector('button').disabled = false;
      log.scrollTop = log.scrollHeight;
    }
  }

  /** Gọi Worker, stream vào bubble, trả về toàn bộ text */
  async function streamLLM(el) {
    const res = await fetch(CHAT_ENDPOINT.replace(/\/$/, '') + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-12), lang: getLang() }),
    });
    if (!res.ok) throw new Error(`chat ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 2);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try { full += JSON.parse(payload).t || ''; } catch {}
        // Hiện phần text trước tag action trong khi stream
        const cut = full.indexOf(ACTION_TAG);
        el.innerHTML = renderMarkdown(cut >= 0 ? full.slice(0, cut) : full) + '<span class="typing">▍</span>';
        log.scrollTop = log.scrollHeight;
      }
    }
    return full;
  }

  /** Fallback không cần server: trả lời từ JSON + Open-Meteo */
  async function ruleBased(q) {
    const lang = getLang();
    const s = q.toLowerCase();
    const [places, foods] = await Promise.all([getPlaces(), getFoods()]);
    // So khớp theo từ (tránh "ăn" khớp trong "Văn"); tiếng Trung không có khoảng trắng nên dùng includes
    const has = (...kw) => kw.some((k) => /[一-鿿]/.test(k) ? s.includes(k) : new RegExp(`(^|[^\\p{L}])${k}(?=$|[^\\p{L}])`, 'u').test(s));
    // Khớp tên đầy đủ hoặc từng phần tên (tách bởi – ( ) , ), phần phải dài >= 4 ký tự (>= 2 với tiếng Trung)
    const nameParts = (name) => ['vi', 'en', 'zh'].flatMap((l) => (name[l] || '').toLowerCase().split(/[–—\-(),]+/).map((x) => x.trim()))
      .filter((x) => x && (/[一-鿿]/.test(x) ? x.length >= 2 : x.length >= 4));
    const matchName = (item) => nameParts(item.name).some((part) => s.includes(part));
    const nameHit = () => places.find(matchName) || foods.find(matchName);

    if (has('thời tiết', 'trời', 'weather', 'rain', 'mưa', '天气', '下雨')) {
      let w;
      try { w = await getWeather(); } catch {
        return { vi: 'Hiện chưa lấy được dữ liệu thời tiết. Bạn thử lại sau ít phút nhé.', en: 'Weather data is unavailable right now, please try again in a few minutes.', zh: '暂时无法获取天气数据，请几分钟后再试。' }[lang];
      }
      const c = w.current;
      const line = { vi: `Hà Nội hiện ${c.temperature_2m}°C, độ ẩm ${c.relative_humidity_2m}%.`,
                     en: `Hanoi is ${c.temperature_2m}°C now, humidity ${c.relative_humidity_2m}%.`,
                     zh: `河内现在${c.temperature_2m}°C，湿度${c.relative_humidity_2m}%。` }[lang];
      const rainy = c.weather_code >= 51;
      const sug = rainy ? ['museum-of-ethnology', 'cafe-giang'] : ['hoan-kiem-lake', 'west-lake'];
      const tail = { vi: rainy ? ' Trời mưa – gợi ý bảo tàng và cà phê:' : ' Trời đẹp – ra hồ dạo chơi nhé:',
                     en: rainy ? ' Rainy – museums and cafés are a good idea:' : ' Nice weather – head to the lakes:',
                     zh: rainy ? ' 下雨——建议去博物馆和咖啡馆：' : ' 天气不错——去湖边走走：' }[lang];
      return `${weatherIcon(c.weather_code, c.is_day)} ${line}${tail}\n${ACTION_TAG}${JSON.stringify([{ type: 'show_places', ids: sug }])}`;
    }
    // Hỏi về một địa điểm/quán cụ thể (giá vé, giờ mở, ở đâu…) – ưu tiên trước
    const specific = nameHit();
    if (specific) {
      const isFood = !!specific.links;
      const price = isFood
        ? `${formatVND(specific.price?.min)}–${formatVND(specific.price?.max)}`
        : (specific.ticket ? formatVND(specific.ticket) : { vi: 'miễn phí', en: 'free', zh: '免费' }[lang]);
      const line = { vi: `**${L(specific.name)}** – ${L(specific.desc)}\n- 🕒 ${specific.hours}\n- ${isFood ? '💵' : '🎫'} ${price}${specific.tip ? `\n- 💡 ${L(specific.tip)}` : ''}`,
                     en: `**${L(specific.name)}** – ${L(specific.desc)}\n- 🕒 ${specific.hours}\n- ${isFood ? '💵' : '🎫'} ${price}${specific.tip ? `\n- 💡 ${L(specific.tip)}` : ''}`,
                     zh: `**${L(specific.name)}** – ${L(specific.desc)}\n- 🕒 ${specific.hours}\n- ${isFood ? '💵' : '🎫'} ${price}${specific.tip ? `\n- 💡 ${L(specific.tip)}` : ''}` }[lang];
      return `${line}\n${ACTION_TAG}${JSON.stringify([{ type: 'show_places', ids: [specific.id] }])}`;
    }
    if (has('ăn', 'food', 'eat', 'phở', 'pho', 'bún', 'quán', 'restaurant', '吃', '美食', '餐厅')) {
      const veg = has('chay', 'vegetarian', 'vegan', '素');
      const list = (veg ? foods.filter((f) => f.diet?.includes('vegetarian')) : foods).slice(0, 4);
      const intro = { vi: 'Vài gợi ý ăn uống nổi tiếng:', en: 'A few famous picks:', zh: '几个著名的推荐：' }[lang];
      return `${intro}\n${list.map((f) => `- **${L(f.name)}** – ${formatVND(f.price.min)}–${formatVND(f.price.max)}`).join('\n')}\n${ACTION_TAG}${JSON.stringify([{ type: 'show_places', ids: list.map((f) => f.id) }])}`;
    }
    if (has('lịch trình', 'itinerary', '1 ngày', 'one day', '行程', '一日')) {
      const ids = ['hoan-kiem-lake', 'old-quarter', 'cafe-giang', 'temple-of-literature', 'cha-ca-thang-long'];
      const intro = { vi: 'Lịch trình 1 ngày gợi ý (bấm ＋ để thêm vào lịch trình của bạn):', en: 'Suggested 1-day plan (press ＋ to add to your itinerary):', zh: '建议一日行程（点＋加入你的行程）：' }[lang];
      return `${intro}\n${ids.map((id, i) => `${i + 1}. **${L(places.find((p) => p.id === id)?.name || foods.find((f) => f.id === id)?.name)}**`).join('\n')}\n${ACTION_TAG}${JSON.stringify([{ type: 'show_places', ids: ids.slice(0, 4) }])}`;
    }
    if (has('vé', 'ticket', 'giá', 'price', '门票', '多少')) {
      const paid = places.filter((p) => p.ticket).slice(0, 4);
      const intro = { vi: 'Giá vé một số điểm chính:', en: 'Ticket prices at main sights:', zh: '主要景点门票：' }[lang];
      return `${intro}\n${paid.map((p) => `- **${L(p.name)}**: ${formatVND(p.ticket)}`).join('\n')}\n${ACTION_TAG}${JSON.stringify([{ type: 'show_places', ids: paid.map((p) => p.id) }])}`;
    }

    return { vi: 'Tôi có thể giúp về địa điểm, ẩm thực, thời tiết và lịch trình ở Hà Nội. Bạn thử hỏi "ăn gì ở phố cổ?" nhé.',
             en: 'I can help with places, food, weather and itineraries in Hanoi. Try "what to eat in the Old Quarter?".',
             zh: '我可以帮你了解河内的景点、美食、天气和行程。试试问"老城区吃什么？"' }[lang];
  }

  async function runActions(actions, el) {
    for (const a of actions) {
      if (a.type === 'show_places' && Array.isArray(a.ids)) {
        const items = (await Promise.all(a.ids.slice(0, 4).map(findItem))).filter(Boolean);
        if (items.length) {
          const wrap = document.createElement('div');
          wrap.className = 'mini-cards';
          wrap.innerHTML = items.map(miniCard).join('');
          el.appendChild(wrap);
          bindAddButtons(wrap);
        }
      }
      if (a.type === 'add_to_itinerary' && Array.isArray(a.ids)) {
        a.ids.forEach((id) => addToItinerary(id, a.day || 1));
        toast(t('chat.added'));
      }
    }
  }
}

/* ---------- utils ---------- */
export function splitActions(full) {
  const i = full.indexOf(ACTION_TAG);
  if (i < 0) return { text: full.trim(), actions: [] };
  let actions = [];
  try { actions = JSON.parse(full.slice(i + ACTION_TAG.length).trim()); } catch {}
  return { text: full.slice(0, i).trim(), actions: Array.isArray(actions) ? actions : [] };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Markdown tối giản & an toàn: **bold**, *italic*, [text](url), danh sách -, 1. */
export function renderMarkdown(md) {
  const lines = escapeHtml(md).split('\n');
  let html = '', inList = null;
  const inline = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  for (const raw of lines) {
    const line = raw.trim();
    const ul = /^[-*•]\s+(.*)/.exec(line), ol = /^\d+[.)]\s+(.*)/.exec(line);
    const type = ul ? 'ul' : ol ? 'ol' : null;
    if (type !== inList) { if (inList) html += `</${inList}>`; if (type) html += `<${type}>`; inList = type; }
    if (type) html += `<li>${inline((ul || ol)[1])}</li>`;
    else if (line) html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += `</${inList}>`;
  return html;
}
