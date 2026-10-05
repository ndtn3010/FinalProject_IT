/**
 * Hanoi Guide Chatbot – Cloudflare Worker proxy
 *
 * - Giấu API key (Gemini hoặc Claude) khỏi frontend
 * - Streaming SSE về client theo định dạng thống nhất: data: {"t":"..."}
 * - Tự nạp places/foods/itineraries từ SITE_ORIGIN + thời tiết Hà Nội (Open-Meteo)
 * - CORS theo whitelist, rate limit đơn giản theo IP
 *
 * Endpoint:  POST /chat   body: { messages:[{role:'user'|'assistant', content}], lang:'vi'|'en'|'zh' }
 *            GET  /health
 */

const HANOI = { lat: 21.0285, lon: 105.8542 };
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;
const RATE_LIMIT = { windowMs: 60_000, max: 20 }; // 20 req/phút/IP (per isolate, đủ cho demo)

const rateMap = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health') return json({ ok: true, provider: provider(env), model: model(env) }, cors);
    if (url.pathname !== '/chat' || request.method !== 'POST') return json({ error: 'Not found' }, cors, 404);
    if (!isAllowedOrigin(origin, env)) return json({ error: 'Origin not allowed' }, cors, 403);
    if (!checkRate(request)) return json({ error: 'Too many requests, try again in a minute' }, cors, 429);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, cors, 400);
    }

    const messages = sanitizeMessages(body.messages);
    if (!messages.length) return json({ error: 'messages required' }, cors, 400);
    const lang = ['vi', 'en', 'zh'].includes(body.lang) ? body.lang : 'vi';

    const [data, weather] = await Promise.all([loadSiteData(env), loadWeather()]);
    const system = buildSystemPrompt({ lang, data, weather });

    try {
      const stream =
        provider(env) === 'claude'
          ? await streamClaude(env, system, messages)
          : await streamGemini(env, system, messages);

      return new Response(stream, {
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err) {
      return json({ error: String(err.message || err) }, cors, 502);
    }
  },
};

/* ---------------- Providers ---------------- */

function provider(env) {
  return (env.PROVIDER || 'gemini').toLowerCase();
}
function model(env) {
  if (env.MODEL) return env.MODEL;
  return provider(env) === 'claude' ? 'claude-haiku-4-5-20251001' : 'gemini-2.5-flash';
}

async function streamGemini(env, system, messages) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing (wrangler secret put GEMINI_API_KEY)');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model(env)}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return relaySSE(res.body, (j) =>
    (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('')
  );
}

async function streamClaude(env, system, messages) {
  if (!env.CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY missing (wrangler secret put CLAUDE_API_KEY)');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model(env),
      max_tokens: 1024,
      temperature: 0.6,
      system,
      messages,
      stream: true,
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return relaySSE(res.body, (j) =>
    j.type === 'content_block_delta' && j.delta?.type === 'text_delta' ? j.delta.text : ''
  );
}

/** Chuyển SSE của provider thành SSE thống nhất: data: {"t":"..."} ... data: [DONE] */
export function relaySSE(upstream, extractText) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = '';
  return upstream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buf += decoder.decode(chunk, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const t = extractText(JSON.parse(payload));
            if (t) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t })}\n\n`));
          } catch {
            /* bỏ qua dòng không phải JSON */
          }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      },
    })
  );
}

/* ---------------- Data & prompt ---------------- */

async function loadSiteData(env) {
  const base = (env.SITE_ORIGIN || '').replace(/\/$/, '');
  if (!base) return { places: [], foods: [], itineraries: [] };
  const get = async (name) => {
    try {
      const r = await fetch(`${base}/data/${name}.json`, {
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
      return r.ok ? await r.json() : [];
    } catch {
      return [];
    }
  };
  const [places, foods, itineraries] = await Promise.all([get('places'), get('foods'), get('itineraries')]);
  return { places, foods, itineraries };
}

async function loadWeather() {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${HANOI.lat}&longitude=${HANOI.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=3`;
    const r = await fetch(u, { cf: { cacheTtl: 900, cacheEverything: true } });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j.current || {};
    const d = j.daily || {};
    const days = (d.time || []).map(
      (t, i) => `${t}: ${d.temperature_2m_min?.[i]}–${d.temperature_2m_max?.[i]}°C, rain ${d.precipitation_probability_max?.[i]}%`
    );
    return `now ${c.temperature_2m}°C, humidity ${c.relative_humidity_2m}%, precipitation ${c.precipitation}mm, WMO code ${c.weather_code}. Next days: ${days.join(' | ')}`;
  } catch {
    return null;
  }
}

const pick = (obj, lang) => (obj && typeof obj === 'object' ? obj[lang] || obj.vi || obj.en || '' : obj || '');

export function buildSystemPrompt({ lang, data, weather }) {
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok' });

  const places = (data.places || [])
    .map((p) => {
      const names = ['vi', 'en', 'zh'].map((l) => pick(p.name, l)).join(' / ');
      return `- [${p.id}] ${names} | type: ${p.type || ''} | ${p.district || ''} | open: ${p.hours || 'n/a'} | ticket: ${fmtPrice(p.ticket)} | ${pick(p.desc, lang)}${p.tip ? ' | tip: ' + pick(p.tip, lang) : ''}`;
    })
    .join('\n');

  const foods = (data.foods || [])
    .map((f) => {
      const names = ['vi', 'en', 'zh'].map((l) => pick(f.name, l)).join(' / ');
      return `- [${f.id}] ${names} | ${f.address || ''} | open: ${f.hours || 'n/a'} | price: ${fmtPrice(f.price)} | ${pick(f.desc, lang)}`;
    })
    .join('\n');

  const itins = (data.itineraries || [])
    .map(
      (it) =>
        `- [${it.id}] ${pick(it.title, lang)}: ${(it.days || [])
          .map((d, i) => `Day ${i + 1}: ${(d.items || []).join(', ')}`)
          .join('; ')}`
    )
    .join('\n');

  const langName = { vi: 'Vietnamese', en: 'English', zh: 'Simplified Chinese (简体中文)' }[lang];

  return `You are "Hà Nội Guide", a friendly, knowledgeable travel assistant embedded in a Hanoi travel-guide website.

RULES
1. Reply in ${langName}. If the user clearly writes in Vietnamese, English or Chinese instead, answer in the language they used.
2. For opening hours, ticket prices, addresses and food prices, prefer the DATA section. If DATA lacks the fact, say you are not certain and suggest checking on site. Never invent prices.
3. Be concise: about 60–120 words, unless the user asks for a multi-day itinerary. Use short bullet lists. Markdown allowed: **bold**, bullet lists, [links](url). No headings, no tables.
4. Call places/foods by their name in the reply language. NEVER print ids like [pho-thin] inside the text.
5. ACTIONS (machine-readable, optional). If useful, append ONE final line, exactly:
   @@ACTIONS@@[ ...json array... ]
   Allowed actions:
   - {"type":"show_places","ids":["id1","id2"]}  → when you recommend specific places/foods from DATA (max 4 ids). Use this often; the website renders cards with map / GrabFood / ShopeeFood buttons.
   - {"type":"add_to_itinerary","ids":["id1"],"day":1} → ONLY when the user explicitly asks to add/save something to their itinerary/plan.
   Ids must exist in DATA. Omit the line entirely if there is no action. Nothing may follow the line.
6. Stay on topic: Hanoi travel (history, places, food, transport, weather, culture, safety, budget). Politely decline unrelated requests in one sentence.
7. Currency: VND. Format like 60.000 ₫ (vi), 60,000 VND (en), 60,000越南盾 (zh).

CURRENT
- Date/time in Hanoi: ${now}
- Weather in Hanoi (Open-Meteo): ${weather || 'unavailable'}

DATA
PLACES:
${places || '(none)'}

FOODS:
${foods || '(none)'}

SAMPLE ITINERARIES:
${itins || '(none)'}`;
}

function fmtPrice(p) {
  if (!p) return 'free/unknown';
  if (typeof p === 'number') return `${p} VND`;
  if (p.min != null && p.max != null) return `${p.min}–${p.max} VND`;
  return JSON.stringify(p);
}

/* ---------------- Helpers ---------------- */

export function sanitizeMessages(list) {
  if (!Array.isArray(list)) return [];
  const out = list
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_MESSAGES);
  // phải bắt đầu bằng user và xen kẽ role
  while (out.length && out[0].role !== 'user') out.shift();
  const merged = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += '\n' + m.content;
    else merged.push({ ...m });
  }
  return merged;
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
function isAllowedOrigin(origin, env) {
  const list = allowedOrigins(env);
  if (!list.length || list.includes('*')) return true; // dev mode
  return list.includes(origin);
}
function corsHeaders(origin, env) {
  const ok = isAllowedOrigin(origin, env);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
function checkRate(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const rec = rateMap.get(ip);
  if (!rec || now > rec.reset) {
    rateMap.set(ip, { count: 1, reset: now + RATE_LIMIT.windowMs });
    return true;
  }
  rec.count += 1;
  return rec.count <= RATE_LIMIT.max;
}
function json(obj, headers, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
