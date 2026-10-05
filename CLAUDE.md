# Hà Nội Guide – hướng dẫn cho Claude Code

## Dự án
Website hướng dẫn du lịch Hà Nội, đồ án môn học. **HTML/CSS/JS thuần, không framework, không build step**
(ngoại trừ `tools/build-pages.mjs` sinh HTML từ layout chung). Host trên GitHub Pages.
Chatbot LLM chạy qua Cloudflare Worker trong `worker/` (Gemini mặc định, có thể chuyển Claude).
Proposal đầy đủ (mục tiêu, phạm vi, F01–F24, phân công): `docs/proposal.txt`. Đọc file này trước khi thêm tính năng mới.

## Quy ước bắt buộc
- **Đa ngôn ngữ vi / en / zh (giản thể)**: mọi chuỗi giao diện mới phải thêm vào cả 3 file `i18n/*.json`
  (cùng key), dùng `data-i18n="key"` trong HTML hoặc `t('key')` trong JS. Nội dung dữ liệu để dạng
  `{ "vi": "...", "en": "...", "zh": "..." }` và lấy bằng `L(obj)`.
- **Dữ liệu trong JSON** (`data/*.json`), render bằng JS. Không hardcode địa điểm/món ăn vào HTML.
  Giữ đúng schema hiện có trong `places.json` / `foods.json` / `hotels.json` (id kebab-case, lat/lng, hours, ticket/price, duration, links;
  hotel: type hotel|hostel|homestay, area oldquarter|hoankiem|westlake|badinh|noibai, budget budget|mid|luxury, price/đêm, `links.*` để trống → tự sinh link tìm kiếm).
  Giá khách sạn = khoảng giá phòng thấp nhất → trung bình mùa thường (VND/đêm), ghi nguồn vào `priceSource` và ngày vào `updated`;
  `budget` suy từ `price.min`: ≤ 1.000.000 budget, < 3.000.000 mid, còn lại luxury. Booking/Agoda chặn đọc tự động, đối chiếu qua Momondo/HotelsCombined/Tripadvisor.
- **Ảnh**: Wikimedia chỉ trả thumbnail ở bề rộng cố định (960, 1280, 1920…); bề rộng khác bị 400. Item thiếu `image` nhưng có `wiki.en`
  sẽ tự lấy ảnh qua Wikipedia REST (`hydrateImages` trong `render.js`).
- **Icon**: sprite SVG trong `tools/build-pages.mjs` (`#i-*`), dùng `icon('name')` trong JS. Không dùng emoji cho UI (chỉ giữ glyph thời tiết).
  Logo thương hiệu (Grab, Shopee, Google Maps, Booking, Google) cũng nằm trong sprite dưới id `#i-l-*`, lấy từ Simple Icons (CC0),
  `fill: currentColor` nên dùng được trên mọi màu nút: `icon('l-grab', 'ic-logo')`. Agoda và Traveloka không có trên Simple Icons nên để chữ.
- **Ảnh món ăn** trong `foods.json` là ảnh minh hoạ món (Wikimedia), không phải ảnh quán; trường `imageNote` ghi rõ điều này.
- **Header/footer chung** nằm trong `tools/build-pages.mjs`. Sửa ở đó rồi chạy `node tools/build-pages.mjs`;
  không sửa tay các file HTML đã sinh.
- **Không commit API key.** Key chỉ nằm trong Worker secret (`wrangler secret put`) hoặc `worker/.dev.vars` (đã gitignore).
- Deep link mở app ngoài (Google Maps, GrabFood, ShopeeFood, Booking, Grab…) lưu trong JSON, mở bằng `target="_blank" rel="noopener"`.
  Trong `foods.json`, `links.grabfood` / `links.shopeefood` = `"auto"` (hoặc URL trang chủ chung) → `deliveryLink()` trong `api.js` tự sinh
  link tìm kiếm theo tên quán tiếng Việt (GrabFood `restaurants?search=`, ShopeeFood `danh-sach-dia-diem-giao-tan-noi?q=`);
  chuỗi rỗng = quán không giao hàng (hiện ghi chú); URL trang quán cụ thể thì giữ nguyên. Mỗi quán có `cat`: noodles | street | dessert.
- Mobile-first, không tràn ngang ở 320px. Dark mode qua `:root[data-theme="dark"]` trong `css/style.css`.
- **Chuyển trang**: `initPageTransitions()` trong `app.js` fade nội dung ra (`body.is-leaving`) rồi mới điều hướng; trang mới `main` fade vào.
  Ô highlight menu là `.nav-indicator` (span trong layout), `initNavIndicator()` lưu vị trí tab cũ vào `sessionStorage` lúc bấm và trượt
  sang tab mới khi trang tải. Không dùng View Transitions API (ảnh chụp tĩnh của nó che mất animation). Mọi animation nằm trong
  `@media (prefers-reduced-motion: no-preference)`.
- Mọi lời gọi API ngoài phải có fallback khi lỗi (không làm trang trắng).
- Comment code bằng tiếng Việt hoặc Anh đều được; commit message tiếng Anh, ngắn gọn.

- **Intro quả địa cầu** (chỉ `index.html`, 1 lần/phiên qua `sessionStorage hg.intro.seen`): markup `INTRO` trong `build-pages.mjs`,
  logic `js/intro.js` (globe.gl 2.46.2 nạp động; địa cầu **vector**: quả cầu màu đặc + `hexPolygonsData` từ GeoJSON Natural Earth 110m
  trên jsDelivr, Việt Nam tô đỏ, không dùng ảnh texture). Chỉ điểm Hà Nội (`.globe-pin`) bấm được:
  `enter({ zoom: true })` → camera `pointOfView` bay xuống Hà Nội 1,5 s → `.is-closing` (scale + fade) → `main.page-enter` hiện dần.
  Không WebGL / CDN lỗi / bấm Bỏ qua / Esc → đóng ngay không zoom. Nền tối cố ý, không theo theme.
  Chấm thủ đô thế giới (`pointsData` từ Natural Earth populated places, `adm0cap===1`, trừ Hà Nội): rê chuột hiện tên, bấm (hoặc bấm
  cách ≤ 2,5°) → hiện `intro.nah` ("Nah bro, hãy đến Hà Nội") và camera lướt về Hà Nội. Đảo Hoàng Sa, Trường Sa, Phú Quốc, Côn Đảo
  vẽ bằng nhãn HTML (`ISLANDS` trong `intro.js`, class `.globe-isle`) vì font 3D của globe.gl thiếu dấu tiếng Việt.

## Kiến trúc JS (`js/`)
- `app.js` – boot chung, logic theo `document.body.dataset.page` (home / places / food / history / itinerary)
- `i18n.js` – `loadLang`, `t`, `L`, `formatVND`, `applyDom`, `baseUrl`
- `api.js` – Open-Meteo (thời tiết, AQI), tỷ giá, Wikipedia, Haversine, hàm tạo URL Google Maps, nạp `data/*.json`
- `storage.js` – lịch trình, yêu thích, My Trip (localStorage)
- `render.js` – `placeCard`, `foodCard`, `miniCard`, `bindAddButtons`, `toast`
- `trip.js` – cửa sổ nổi Lịch trình trên mọi trang (nút tròn trên nút chat): bản đồ Leaflet 1.9.4 (OSM, nạp động khi mở), chip ngày,
  danh sách điểm, xoá nhanh, link tuyến đường. Nghe `storagechange` để tự cập nhật; sự kiện `hg:panel` để chat/trip không mở cùng lúc.
- `intro.js` – màn hình quả địa cầu (xem mục Intro).
- `chatbot.js` – widget; `window.HG_CHAT_ENDPOINT` trống → chế độ rule-based, có URL Worker → streaming SSE.
  Giao thức action: dòng cuối `@@ACTIONS@@[{"type":"show_places","ids":[...]}, {"type":"add_to_itinerary","ids":[...],"day":1}]`

## Chạy & kiểm tra
```bash
python3 -m http.server 8080      # ES modules không chạy qua file://
node tools/build-pages.mjs       # sau khi sửa layout chung
node --check js/*.js             # kiểm tra cú pháp
cd worker && wrangler dev        # chạy chatbot proxy local
```
Sau khi sửa, mở từng trang ở cả 3 ngôn ngữ và kiểm tra console không có lỗi.

## Việc còn lại theo proposal (ưu tiên MVP F01–F13)
1. Bổ sung dữ liệu: ≥30 địa điểm (hiện 12), ≥4 lịch trình (hiện 2), ảnh khách sạn có nguồn (`hotels.json` hiện để `image` trống). Quán ăn đã đủ 23; còn thiếu ảnh cho `pho-cuon-hung-ben`, `banh-goi-ly-quoc-su`.
2. ~~Trang `pages/hotels.html` + `data/hotels.json`~~ – đã xong (25 chỗ nghỉ, lọc khu vực/ngân sách/loại, deep link Booking/Agoda/Traveloka/Google Hotels có ngày & số khách từ My Trip). Còn: test link trên thiết bị thật, chatbot action `show_hotels`.
3. Trang `pages/guide.html` – di chuyển, SIM, visa, khẩn cấp, lừa đảo phổ biến, phrasebook.
4. Bản đồ Leaflet ở trang địa điểm (đã có Leaflet trong cửa sổ nổi lịch trình, `trip.js`, có thể tái dùng); xuất PDF lịch trình (jsPDF); share QR.
5. Deploy Worker, điền `HG_CHAT_ENDPOINT`, test chatbot 30 câu × 3 ngôn ngữ.
