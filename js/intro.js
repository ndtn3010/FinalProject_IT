// intro.js – màn hình mở đầu: quả địa cầu 3D (globe.gl, WebGL) xoay được, chỉ có một điểm Hà Nội bấm được để vào web.
// Hiện 1 lần mỗi phiên (sessionStorage 'hg.intro.seen'). Không có WebGL / CDN lỗi -> bỏ qua ngay, không chặn trang.
import { t } from './i18n.js';

const GLOBE_JS = 'https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js';
const COUNTRIES = 'https://cdn.jsdelivr.net/gh/vasturiano/globe.gl@2.46.2/example/datasets/ne_110m_admin_0_countries.geojson';
const CAPITALS = 'https://cdn.jsdelivr.net/gh/vasturiano/globe.gl@2.46.2/example/datasets/ne_110m_populated_places_simple.geojson';
const HANOI = { lat: 21.0285, lng: 105.8542 };
const SEEN = 'hg.intro.seen';
// Hoàng Sa, Trường Sa, Phú Quốc, Côn Đảo: dữ liệu Natural Earth 110m không có đảo nhỏ nên vẽ riêng (chấm đỏ + tên)
// side: phía đặt nhãn so với chấm, để các nhãn gần nhau không chồng lên nhau
const ISLANDS = [
  { key: 'intro.hoangsa', lat: 16.5, lng: 112.0, side: 'right' },
  { key: 'intro.truongsa', lat: 9.6, lng: 113.4, side: 'right' },
  { key: 'intro.phuquoc', lat: 10.22, lng: 103.96, side: 'left' },
  { key: 'intro.condao', lat: 8.68, lng: 106.6, side: 'bottom' },
];

export function initIntro() {
  const root = document.getElementById('intro');
  if (!root || !document.documentElement.classList.contains('intro-open')) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let globe = null, closed = false;

  /** Đóng intro. zoom=true (bấm Hà Nội): camera bay xuống Hà Nội rồi màn hình phóng to, tan ra để lộ trang chủ */
  const enter = ({ zoom = false } = {}) => {
    if (closed) return;
    closed = true;
    try { sessionStorage.setItem(SEEN, '1'); } catch {}
    root.classList.add('is-entering'); // ẩn chữ hướng dẫn, nút, pin

    const finish = () => {
      root.classList.add('is-closing');
      const main = document.querySelector('main');
      if (main && !reduce) { main.classList.remove('page-enter'); void main.offsetWidth; main.classList.add('page-enter'); }
      setTimeout(() => {
        try { globe?.pauseAnimation(); globe?._destructor?.(); } catch {}
        root.remove();
        document.documentElement.classList.remove('intro-open');
      }, reduce ? 0 : 700);
    };

    if (zoom && globe && !reduce) {
      const c = globe.controls();
      c.autoRotate = false;
      c.enabled = false;
      c.minDistance = 101; // cho phép bay sát bề mặt (bán kính quả cầu = 100)
      globe.ringsData([]);
      globe.pointOfView({ lat: HANOI.lat, lng: HANOI.lng, altitude: 0.09 }, 1500);
      setTimeout(finish, 1350);
    } else {
      finish();
    }
  };

  root.querySelector('[data-intro-skip]')?.addEventListener('click', () => enter());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') enter(); });

  if (!hasWebGL()) { enter(); return; }
  const stage = root.querySelector('.intro-globe');
  stage.addEventListener('pointerdown', () => { if (globe && !closed) globe.controls().autoRotate = false; }, { once: true }); // người dùng tự xoay thì thôi tự quay
  loadScript(GLOBE_JS).then(() => {
    if (closed || !window.Globe) { enter(); return; }
    // Địa cầu vector: quả cầu màu đặc + chấm lục giác theo biên giới quốc gia (Natural Earth 110m), không dùng ảnh texture
    globe = window.Globe({ animateIn: !reduce })(stage)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#4a7bff')
      .atmosphereAltitude(0.2)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.35)
      .hexPolygonUseDots(true)
      .hexPolygonAltitude(0.004)
      .hexPolygonColor((d) => (d.properties?.ISO_A2 === 'VN' ? '#e04a50' : 'rgba(210,220,240,0.55)'))
      // Vòng sóng lan từ Hà Nội
      .ringsData([HANOI])
      .ringColor(() => (x) => `rgba(224,74,80,${1 - x})`)
      .ringMaxRadius(3.5)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(1100)
      // Điểm Hà Nội là nút HTML thật (hit-area lớn, bấm là vào web) + nhãn HTML cho các đảo
      // (nhãn HTML hiển thị đủ dấu tiếng Việt; font 3D mặc định của globe.gl không có glyph ơ, ả, đ...)
      .htmlElementsData([{ ...HANOI, kind: 'pin' }, ...ISLANDS.map((i) => ({ ...i, kind: 'island' }))])
      .htmlAltitude(0.012)
      .htmlElement((d) => {
        if (d.kind === 'island') {
          const el = document.createElement('span');
          el.className = `globe-isle ${d.side || 'right'}`;
          el.dataset.key = d.key;
          el.innerHTML = `<i></i><span>${t(d.key)}</span>`;
          return el;
        }
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'globe-pin';
        // Nhãn ở trên, chấm đỏ ở dưới cùng: đáy phần tử = đúng toạ độ Hà Nội
        el.innerHTML = `<span class="globe-pin-label">${t('intro.pin')}</span><span class="globe-pin-dot"></span>`;
        el.setAttribute('aria-label', t('intro.enter'));
        el.style.pointerEvents = 'auto';
        el.addEventListener('click', (e) => { e.stopPropagation(); enter({ zoom: true }); });
        return el;
      })
      .width(stage.clientWidth)
      .height(stage.clientHeight);

    const mat = globe.globeMaterial();
    mat.color.set('#0f1830');
    mat.emissive.set('#0b1226');
    mat.emissiveIntensity = 0.35;
    mat.shininess = 4;
    fetch(COUNTRIES).then((r) => r.json()).then((geo) => { if (!closed && globe) globe.hexPolygonsData(geo.features); }).catch(() => {});

    // Chấm các thủ đô khác trên thế giới: rê chuột hiện tên, bấm vào thì "Nah bro, hãy đến Hà Nội" và camera lướt về Hà Nội
    const nah = root.querySelector('.intro-nah');
    let nahTimer = 0;
    fetch(CAPITALS).then((r) => r.json()).then((geo) => {
      if (closed || !globe) return;
      const caps = geo.features
        .filter((f) => f.properties?.adm0cap === 1 && !/hanoi/i.test(f.properties.name || ''))
        .map((f) => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], name: f.properties.name, country: f.properties.adm0name }));
      const sayNah = (d) => {
        if (closed || !nah) return;
        nah.textContent = t('intro.nah', { city: d.name });
        nah.hidden = false;
        nah.classList.remove('is-in'); void nah.offsetWidth; nah.classList.add('is-in');
        clearTimeout(nahTimer);
        nahTimer = setTimeout(() => { nah.hidden = true; }, 2600);
        if (!reduce) {
          const cur = globe.pointOfView();
          globe.controls().autoRotate = false;
          globe.pointOfView({ lat: HANOI.lat, lng: HANOI.lng, altitude: Math.max(1.4, cur.altitude) }, 1200);
        }
      };
      // Bấm gần một thủ đô (trong ~2,5°) cũng tính, để dễ chạm trên điện thoại
      const nearest = ({ lat, lng }) => {
        let best = null, bd = 2.5;
        for (const c of caps) { const d = Math.hypot(c.lat - lat, (c.lng - lng) * Math.cos((lat * Math.PI) / 180)); if (d < bd) { bd = d; best = c; } }
        return best;
      };
      globe
        .pointsData(caps)
        .pointLat('lat').pointLng('lng')
        .pointColor(() => 'rgba(255,255,255,0.9)')
        .pointAltitude(0.006)
        .pointRadius(0.4)
        .pointsMerge(false)
        .pointLabel((d) => `<div class="globe-tip"><strong>${d.name}</strong><span>${d.country}</span></div>`)
        .onPointHover((d) => { stage.style.cursor = d ? 'pointer' : ''; })
        .onPointClick(sayNah)
        .onGlobeClick((coords) => { const c = nearest(coords); if (c) sayNah(c); });
    }).catch(() => {});

    globe.pointOfView({ lat: 18, lng: 106, altitude: 2.1 }, 0);
    const c = globe.controls();
    c.autoRotate = !reduce;
    c.autoRotateSpeed = 0.45;
    c.enablePan = false;
    c.minDistance = 160;
    c.maxDistance = 520;
    root.classList.add('is-ready');

    const fit = () => { if (globe && !closed) globe.width(stage.clientWidth).height(stage.clientHeight); };
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage); else addEventListener('resize', fit);
    // Đổi ngôn ngữ trong lúc intro đang mở -> cập nhật nhãn pin
    document.addEventListener('langchange', () => {
      const l = stage.querySelector('.globe-pin-label'); if (l) l.textContent = t('intro.pin');
      stage.querySelectorAll('.globe-isle[data-key]').forEach((el) => { el.querySelector('span').textContent = t(el.dataset.key); });
    });
  }).catch(() => enter());
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Globe) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('globe.gl load failed'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('globe.gl timeout')), 15000);
  });
}
