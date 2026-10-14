# Hà Nội Guide – hướng dẫn cho Claude Code

## Dự án
Website du lịch Hà Nội, bài tập cuối kì nhóm 2 (6 thành viên, danh sách trong `MEMBERS` ở `tools/build-pages.mjs`). **HTML/CSS/JS thuần, không framework, không build step**
(ngoại trừ `tools/build-pages.mjs` sinh HTML từ layout chung). Host trên GitHub Pages. **Chỉ tiếng Việt, chỉ giao diện tối**; đã bỏ intro quả địa cầu, chatbot, chọn ngôn ngữ và nút sáng/tối (10/2026).
Proposal ngắn bằng tiếng Việt (mục tiêu, nội dung, kế hoạch, phân công): `docs/proposal.txt`. Đọc file này trước khi thêm tính năng mới.

## Quy ước bắt buộc
- **Chuỗi giao diện** nằm trong `i18n/vi.json`, dùng `data-i18n="key"` trong HTML hoặc `t('key')` trong JS.
  Dữ liệu vẫn giữ dạng `{ "vi": "...", "en": "...", "zh": "..." }` (tên `en` dùng làm từ khoá tìm trên Booking/Agoda), hiển thị bằng `L(obj)` (lấy `vi`).
  Chữ hiển thị thẳng từ dữ liệu (`hours`, `address`) viết tiếng Việt.
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
- **Không commit API key.**
- Deep link mở app ngoài (Google Maps, GrabFood, ShopeeFood, Booking, Grab…) lưu trong JSON, mở bằng `target="_blank" rel="noopener"`.
  Trong `foods.json`, `links.grabfood` / `links.shopeefood` = `"auto"` (hoặc URL trang chủ chung) → `deliveryLink()` trong `api.js` tự sinh
  link tìm kiếm theo tên quán tiếng Việt (GrabFood `restaurants?search=`, ShopeeFood `danh-sach-dia-diem-giao-tan-noi?q=`);
  chuỗi rỗng = quán không giao hàng (hiện ghi chú); URL trang quán cụ thể thì giữ nguyên. Mỗi quán có `cat`: noodles | street | dessert.
- Mobile-first, không tràn ngang ở 320px. Chỉ một bảng màu tối trong `:root` của `css/style.css`.
- **Chuyển trang**: `initPageTransitions()` trong `app.js` fade nội dung ra (`body.is-leaving`) rồi mới điều hướng; trang mới `main` fade vào.
  Ô highlight menu là `.nav-indicator` (span trong layout), `initNavIndicator()` lưu vị trí tab cũ vào `sessionStorage` lúc bấm và trượt
  sang tab mới khi trang tải. Không dùng View Transitions API (ảnh chụp tĩnh của nó che mất animation). Mọi animation nằm trong
  `@media (prefers-reduced-motion: no-preference)`.
- **Trang Địa điểm / Ẩm thực chỉ có ô tìm kiếm** (không phân biệt dấu, `fold()` trong `i18n.js`), không chip lọc.
  **Trang Khách sạn chỉ liệt kê**, không lọc/sắp xếp, không form ngày (link đặt phòng chỉ tìm theo tên, người dùng tự chọn ngày trên trang đặt phòng).
- Nút "Thêm vào lịch trình" vẽ theo `isInItinerary()` và tự đồng bộ qua sự kiện `storagechange` (`render.js`);
  `storage.js` phát lại sự kiện này khi tab khác đổi dữ liệu và khi trang được lấy lại từ bfcache. Trang Lịch trình cũng vẽ lại theo sự kiện đó.
- **Trang Lịch sử**: mỗi mốc trong `history.json` có `year`, `title`, `desc` (hiện trên ô timeline) và `when`, `who`, `where`,
  `detail.vi` (các đoạn cách nhau bằng dòng trống), `fact`, `image` (thumbnail Wikimedia 960px, hoặc file gốc nếu ảnh nhỏ hơn), `imageAlt` (làm chú thích ảnh).
  Trường mới chỉ cần `vi`. Bấm ô mở cửa sổ `<dialog id="tl-dialog">` (markup trong `build-pages.mjs`, logic `openHistory()` trong `app.js`):
  Esc / nút X / bấm nền để đóng, nút mốc trước / sau. Nội dung viết đầy đủ trong dữ liệu, không link ra Wikipedia/Google.
- Mọi lời gọi API ngoài phải có fallback khi lỗi (không làm trang trắng).
- Comment code bằng tiếng Việt hoặc Anh đều được; commit message tiếng Anh, ngắn gọn.


## Kiến trúc JS (`js/`)
- `app.js` – boot chung, logic theo `document.body.dataset.page` (home / places / food / hotels / history / itinerary)
- `i18n.js` – `loadStrings`, `t`, `L`, `formatVND`, `fold`, `applyDom`, `baseUrl`
- `api.js` – Open-Meteo (thời tiết, AQI), Wikipedia (`wikiThumb`, `wikiLink`), Haversine, hàm tạo URL Google Maps / đặt phòng / giao đồ ăn, nạp `data/*.json`
- `storage.js` – lịch trình (localStorage)
- `render.js` – `placeCard`, `foodCard`, `hotelCard`, `bindAddButtons`, `toast`
- `trip.js` – cửa sổ nổi Lịch trình trên mọi trang (nút tròn góc dưới phải): bản đồ Leaflet 1.9.4 (OSM, nạp động khi mở), chip ngày,
  danh sách điểm, xoá nhanh, link tuyến đường. Nghe `storagechange` để tự cập nhật.

## Chạy & kiểm tra
```bash
node tools/serve.mjs             # ES modules không chạy qua file://
node tools/build-pages.mjs       # sau khi sửa layout chung
node tools/build-info.mjs        # sau khi sửa data/*.json (sinh lại hanoi-info.txt, không sửa tay file đó)
node --check js/*.js             # kiểm tra cú pháp
```
Sau khi sửa, mở từng trang và kiểm tra console không có lỗi.

## Việc còn lại (mục 5 trong proposal)
1. Bổ sung dữ liệu: ≥30 địa điểm (hiện 12), ≥4 lịch trình (hiện 2), ảnh khách sạn có nguồn (`hotels.json` hiện để `image` trống). Quán ăn đã đủ 23; còn thiếu ảnh cho `pho-cuon-hung-ben`, `banh-goi-ly-quoc-su`.
2. ~~Trang `pages/hotels.html` + `data/hotels.json`~~ – đã xong (25 chỗ nghỉ, chỉ liệt kê, deep link Booking/Agoda/Traveloka/Google Hotels tìm theo tên). Còn: test link trên thiết bị thật.
3. Trang `pages/guide.html` – di chuyển, SIM, visa, khẩn cấp, lừa đảo phổ biến, phrasebook.
4. Bản đồ Leaflet ở trang địa điểm (đã có Leaflet trong cửa sổ nổi lịch trình, `trip.js`, có thể tái dùng); xuất PDF lịch trình (jsPDF); share QR.
