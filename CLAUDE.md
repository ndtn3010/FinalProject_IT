# Hà Nội Guide – hướng dẫn cho Claude Code

## Dự án
Website du lịch Hà Nội, bài tập cuối kì nhóm 2 (6 thành viên, danh sách trong `MEMBERS` ở `tools/build-pages.mjs`). **HTML/CSS/JS thuần, không framework, không build step**
(ngoại trừ `tools/build-pages.mjs` sinh HTML từ layout chung). Host trên GitHub Pages. **Chỉ tiếng Việt, chỉ giao diện tối**; đã bỏ intro quả địa cầu, chatbot, đa ngôn ngữ (cả hệ thống i18n) và nút sáng/tối (10/2026).
Code phải **dễ đọc và dễ giải thích** cho người mới (nhóm thuyết trình phải giải thích từng dòng): hàm ngắn, tên biến rõ nghĩa,
comment tiếng Việt, tránh viết gộp nhiều việc trên một dòng.
Proposal ngắn bằng tiếng Việt (mục tiêu, nội dung, kế hoạch, phân công): `docs/proposal.txt`. Đọc file này trước khi thêm tính năng mới.

## Quy ước bắt buộc
- **Chữ tiếng Việt viết thẳng** trong HTML (`tools/build-pages.mjs`) và JS. Không có file ngôn ngữ, không `t()`.
  Tên tiếng Việt cho các mã trong dữ liệu (type, dish, area, budget) nằm trong `js/labels.js`.
  Dữ liệu là chuỗi tiếng Việt thường (`"name": "Văn Miếu – Quốc Tử Giám"`); khách sạn có thêm `nameEn` để tìm trên Booking/Agoda;
  `wiki` là tên bài Wikipedia tiếng Anh (chỉ dùng để lấy ảnh khi thiếu `image`).
- **Dữ liệu trong JSON** (`data/*.json`), render bằng JS. Không hardcode địa điểm/món ăn vào HTML.
  Giữ đúng schema hiện có trong `places.json` / `foods.json` / `hotels.json` (id kebab-case, lat/lng, hours, ticket/price, duration, links;
  hotel: type hotel|hostel|homestay, area oldquarter|hoankiem|westlake|badinh|noibai, budget budget|mid|luxury, price/đêm, `links.*` để trống → tự sinh link tìm kiếm).
  Giá khách sạn = khoảng giá phòng thấp nhất → trung bình mùa thường (VND/đêm), ghi nguồn vào `priceSource` và ngày vào `updated`;
  `budget` suy từ `price.min`: ≤ 1.000.000 budget, < 3.000.000 mid, còn lại luxury. Booking/Agoda chặn đọc tự động, đối chiếu qua Momondo/HotelsCombined/Tripadvisor.
- **Ảnh**: Wikimedia chỉ trả thumbnail ở bề rộng cố định (960, 1280, 1920…); bề rộng khác bị 400. Item thiếu `image` nhưng có `wiki`
  sẽ tự lấy ảnh qua Wikipedia REST (`loadMissingImages` trong `render.js`, `wikiImage` trong `api.js`).
- **Icon**: sprite SVG trong `tools/build-pages.mjs` (`#i-*`), dùng `icon('name')` trong JS. Không dùng emoji cho UI (chỉ giữ glyph thời tiết).
  Logo thương hiệu (Grab, Shopee, Google Maps, Booking, Google) cũng nằm trong sprite dưới id `#i-l-*`, lấy từ Simple Icons (CC0),
  `fill: currentColor` nên dùng được trên mọi màu nút: `icon('l-grab', 'ic-logo')`. Agoda và Traveloka không có trên Simple Icons nên để chữ.
- **Ảnh món ăn** trong `foods.json` là ảnh minh hoạ món (Wikimedia), không phải ảnh quán; trường `imageNote` ghi rõ điều này.
- **Header/footer chung** nằm trong `tools/build-pages.mjs`. Sửa ở đó rồi chạy `node tools/build-pages.mjs`;
  không sửa tay các file HTML đã sinh.
- **Không commit API key.**
- Deep link mở app ngoài (Google Maps, GrabFood, ShopeeFood, Booking, Grab…) lưu trong JSON, mở bằng `target="_blank" rel="noopener"`.
  Trong `foods.json`, `links.grabfood` / `links.shopeefood` = `"auto"` → `deliveryLink()` trong `api.js` tự sinh
  link tìm kiếm theo tên quán tiếng Việt (GrabFood `restaurants?search=`, ShopeeFood `danh-sach-dia-diem-giao-tan-noi?q=`);
  chuỗi rỗng = quán không giao hàng (hiện ghi chú); URL trang quán cụ thể thì giữ nguyên. Mỗi quán có `cat`: noodles | street | dessert.
- Mobile-first, không tràn ngang ở 320px. Chỉ một bảng màu tối trong `:root` của `css/style.css`.
- **Chuyển trang**: `initPageTransitions()` trong `app.js` fade nội dung ra (`body.is-leaving`) rồi mới điều hướng; trang mới `main` fade vào.
  Ô highlight menu là `.nav-indicator` (span trong layout), `initNavIndicator()` lưu vị trí tab cũ vào `sessionStorage` lúc bấm và trượt
  sang tab mới khi trang tải. Không dùng View Transitions API (ảnh chụp tĩnh của nó che mất animation). Mọi animation nằm trong
  `@media (prefers-reduced-motion: no-preference)`.
- **Trang Địa điểm / Ẩm thực chỉ có ô tìm kiếm** (không phân biệt dấu, `removeAccents()` / `matchesSearch()` trong `utils.js`), không chip lọc.
  **Trang Khách sạn chỉ liệt kê**, không lọc/sắp xếp, không form ngày (link đặt phòng chỉ tìm theo tên, người dùng tự chọn ngày trên trang đặt phòng).
- Nút "Thêm vào lịch trình" vẽ theo `isInItinerary()` và tự đồng bộ qua sự kiện `storagechange` (`refreshAddButton` trong `render.js`);
  `storage.js` phát lại sự kiện này khi tab khác đổi dữ liệu và khi trang được lấy lại từ bfcache. Trang Lịch trình cũng vẽ lại theo sự kiện đó.
- **Trang Lịch sử**: mỗi mốc trong `history.json` có `year`, `title`, `desc` (hiện trên ô timeline) và `when`, `who`, `where`,
  `detail` (các đoạn cách nhau bằng một dòng trống), `fact`, `image` (thumbnail Wikimedia 960px, hoặc file gốc nếu ảnh nhỏ hơn), `imageAlt` (làm chú thích ảnh).
  Bấm ô mở cửa sổ `<dialog id="tl-dialog">` (markup trong `build-pages.mjs`, logic `openDetail()` trong `history.js`):
  Esc / nút X / bấm nền để đóng, nút mốc trước / sau. Nội dung viết đầy đủ trong dữ liệu, không link ra Wikipedia/Google.
- **Chống cache**: `build-pages.mjs` tính `VERSION` (hash css/js/data), gắn `?v=` vào style.css, app.js, import map cho mọi module
  trong `js/` và `<meta name="hg-version">`; `withVersion()` trong `utils.js` gắn mã đó vào fetch JSON. Thêm file JS mới thì import map tự có.
- Mọi lời gọi API ngoài phải có fallback khi lỗi (không làm trang trắng).
- Comment code bằng tiếng Việt hoặc Anh đều được; commit message tiếng Anh, ngắn gọn.


## Kiến trúc JS (`js/`)
- `app.js` – chạy trên mọi trang: menu, chuyển trang, ô highlight menu, rồi gọi hàm của trang theo `<body data-page>` (bảng `PAGES`)
- Mỗi trang một file: `home.js` (thời tiết, nổi bật), `places.js`, `food.js`, `hotels.js`, `history.js`, `itinerary.js` (cả `showSamples` dùng ở trang chủ)
- `utils.js` – `formatVND`, `removeAccents`, `matchesSearch`, `escapeHtml`, `baseUrl`, `withVersion`
- `labels.js` – tên tiếng Việt của các mã trong dữ liệu
- `api.js` – nạp `data/*.json`, Open-Meteo (thời tiết, AQI), `wikiImage`, Haversine, hàm tạo URL Google Maps / đặt phòng / giao đồ ăn
- `storage.js` – lịch trình (localStorage), phát sự kiện `storagechange`
- `render.js` – `placeCard`, `foodCard`, `hotelCard`, `sampleCard`, `bindAddButtons`, `showToast`, `icon`
- `trip.js` – cửa sổ nổi Lịch trình trên mọi trang (nút tròn góc dưới phải): bản đồ Leaflet 1.9.4 (OSM, nạp động khi mở), chip ngày,
  danh sách điểm, xoá nhanh, link tuyến đường. Nghe `storagechange` để tự cập nhật.

## Chạy & kiểm tra
```bash
node tools/serve.mjs             # ES modules không chạy qua file://
node tools/build-pages.mjs       # sau khi sửa layout chung HOẶC bất kỳ file css/ js/ data/ (cập nhật mã ?v= chống cache)
node tools/build-info.mjs        # sau khi sửa data/*.json (sinh lại hanoi-info.txt, không sửa tay file đó)
node --check js/*.js             # kiểm tra cú pháp
```
Sau khi sửa, mở từng trang và kiểm tra console không có lỗi.

## Việc còn lại (mục 5 trong proposal)
1. Bổ sung dữ liệu: ≥30 địa điểm (hiện 12), ≥4 lịch trình (hiện 2), ảnh khách sạn có nguồn (`hotels.json` hiện để `image` trống). Quán ăn đã đủ 23; còn thiếu ảnh cho `pho-cuon-hung-ben`, `banh-goi-ly-quoc-su`.
2. ~~Trang `pages/hotels.html` + `data/hotels.json`~~ – đã xong (25 chỗ nghỉ, chỉ liệt kê, deep link Booking/Agoda/Traveloka/Google Hotels tìm theo tên). Còn: test link trên thiết bị thật.
3. Trang `pages/guide.html` – di chuyển, SIM, visa, khẩn cấp, lừa đảo phổ biến, phrasebook.
4. Bản đồ Leaflet ở trang địa điểm (đã có Leaflet trong cửa sổ nổi lịch trình, `trip.js`, có thể tái dùng); xuất PDF lịch trình (jsPDF); share QR.
