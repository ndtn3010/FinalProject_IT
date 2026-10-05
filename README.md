# Hà Nội Guide 🏮

Website hướng dẫn du lịch Hà Nội đa ngôn ngữ (VI / EN / 中文) – đồ án môn học.
HTML, CSS, JavaScript thuần, không framework, tích hợp API miễn phí và chatbot AI.

**Live demo:** https://<username>.github.io/hanoi-guide/ *(cập nhật sau khi bật GitHub Pages)*

## Tính năng

| Module | Mô tả |
|---|---|
| Trang chủ | Màn hình mở đầu quả địa cầu 3D dạng vector (globe.gl + GeoJSON quốc gia, xoay được, chạm điểm Hà Nội để zoom và vào web, 1 lần/phiên, có nút bỏ qua), hero, thời tiết + AQI Hà Nội (Open-Meteo), địa điểm nổi bật, ẩm thực, lịch trình mẫu |
| Lịch sử | Timeline Thăng Long → Hà Nội, animation khi cuộn |
| Địa điểm | 12 địa điểm có ảnh Wikimedia, lọc theo loại, tìm kiếm, "Gần tôi" (Geolocation), chỉ đường Google Maps, thêm vào lịch trình |
| Ẩm thực | 23 quán có ảnh món, lọc theo nhóm món / chay, nút Google Maps / GrabFood / ShopeeFood mở thẳng trang tìm kiếm tên quán |
| Lịch trình | Kéo-thả (SortableJS), tính chi phí + thời gian, cảnh báo ngày quá dày, mở tuyến đường Google Maps, nạp lịch trình mẫu. Cửa sổ nổi trên mọi trang với bản đồ Leaflet/OSM, danh sách điểm theo ngày, xoá nhanh |
| Khách sạn | 25 khách sạn / hostel / homestay theo khu vực, ngân sách, loại; chọn ngày & số khách (lưu vào My Trip); nút Booking.com / Agoda / Traveloka / Google Hotels tự điền ngày và số khách |
| Chatbot | LLM (Gemini/Claude) qua Cloudflare Worker, streaming, trả lời 3 thứ tiếng, hiện card địa điểm, tự thêm vào lịch trình. Không có Worker → tự chuyển sang chế độ rule-based |
| Đa ngôn ngữ | `i18n/*.json` cho giao diện, `{vi,en,zh}` trong dữ liệu |
| Dark mode | Lưu localStorage |

## Cấu trúc

```
index.html            Trang chủ
pages/                places, food, hotels, itinerary, history
css/style.css
js/
  app.js              Khởi tạo + logic từng trang
  i18n.js             Đa ngôn ngữ
  api.js              Open-Meteo, tỷ giá, Wikipedia, deep links, Haversine
  storage.js          Lịch trình / yêu thích / My Trip (localStorage)
  render.js           Card địa điểm, món ăn, mini-card chatbot
  chatbot.js          Widget chatbot (streaming + fallback)
  trip.js             Cửa sổ nổi lịch trình + bản đồ Leaflet
  intro.js            Màn hình mở đầu quả địa cầu (globe.gl)
data/                 places.json, foods.json, hotels.json, itineraries.json, history.json
i18n/                 vi.json, en.json, zh.json
worker/               Cloudflare Worker – proxy chatbot (giấu API key)
tools/build-pages.mjs Sinh HTML từ layout chung (chạy lại sau khi sửa header/footer)
docs/proposal.txt     Proposal
```

## Chạy local

Cần một HTTP server (ES modules không chạy qua `file://`):

```bash
node tools/serve.mjs        # http://localhost:8080 và in ra địa chỉ LAN cho người cùng mạng
# hoặc: python3 -m http.server 8080 / npx serve .
```

Mở http://localhost:8080. Người cùng mạng Wi-Fi mở địa chỉ `http://<IP máy bạn>:8080/` mà script in ra
(Windows: lần đầu chạy Node có thể hiện hộp thoại Firewall, chọn Allow).

Sau khi sửa layout chung trong `tools/build-pages.mjs`:

```bash
node tools/build-pages.mjs
```

## Deploy web lên GitHub Pages

1. Push code lên GitHub.
2. Repo → **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`** → Save.
3. Sau ~1 phút site chạy tại `https://<username>.github.io/<repo>/`.

## Deploy chatbot (Cloudflare Worker)

```bash
cd worker
npm install -g wrangler
wrangler login
# Sửa SITE_ORIGIN và ALLOWED_ORIGINS trong wrangler.toml cho đúng domain GitHub Pages
wrangler secret put GEMINI_API_KEY      # lấy key miễn phí tại https://aistudio.google.com/apikey
wrangler deploy
```

Worker in ra URL dạng `https://hanoi-guide-chatbot.<account>.workers.dev`.
Dán URL đó vào `window.HG_CHAT_ENDPOINT = "..."` trong `tools/build-pages.mjs`, chạy `node tools/build-pages.mjs`, commit & push.

Dùng Claude thay Gemini: đặt `PROVIDER = "claude"` trong `wrangler.toml` và `wrangler secret put CLAUDE_API_KEY`.

Chạy Worker local: copy `.dev.vars.example` → `.dev.vars`, điền key, `wrangler dev`.

### Giao thức chatbot

`POST /chat` `{ messages: [{role, content}], lang: "vi"|"en"|"zh" }` → SSE `data: {"t":"..."}` … `data: [DONE]`.

Model có thể thêm dòng cuối `@@ACTIONS@@[...]` với:
- `{"type":"show_places","ids":[...]}` → web hiện mini-card có nút Maps / Grab / Shopee / ＋
- `{"type":"add_to_itinerary","ids":[...],"day":1}` → web tự thêm vào lịch trình

## Deep link đặt phòng (js/api.js → hotelLinks)

| Nền tảng | URL sinh ra |
|---|---|
| Booking.com | `searchresults.html?ss=<tên>&checkin=&checkout=&group_adults=&no_rooms=1` |
| Agoda | `search?city=2758&textToSearch=<tên>&checkIn=&checkOut=&adults=&rooms=1` |
| Traveloka | `hotel/search?spec=DD-MM-YYYY.DD-MM-YYYY.<đêm>.1.HOTEL_GEO.10009843.Hanoi.<khách>` |
| Google Hotels | `travel/search?q=<tên>&check_in_date=&check_out_date=&adults=` |

Nếu `hotels.json` có `links.booking` / `links.agoda`… (trang riêng của khách sạn) thì dùng link đó và gắn thêm tham số ngày.

## API sử dụng

- [Open-Meteo](https://open-meteo.com/) – thời tiết, AQI (không cần key)
- [open.er-api.com](https://www.exchangerate-api.com/docs/free) – tỷ giá
- [Wikipedia REST API](https://www.mediawiki.org/wiki/API:REST_API) – tóm tắt địa điểm
- Google Maps URLs, GrabFood, ShopeeFood – deep link
- Google Gemini / Anthropic Claude – chatbot (qua Worker)
- [globe.gl](https://globe.gl/) + GeoJSON Natural Earth (jsDelivr) – quả địa cầu vector mở đầu
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles – bản đồ trong cửa sổ lịch trình
- Browser: Geolocation, localStorage, sessionStorage

## Thành viên

| Tên | Vai trò |
|---|---|
| … | Leader / layout, i18n, deploy |
| … | Địa điểm, bản đồ, lịch sử |
| … | Ẩm thực, lịch trình, widgets |
| … | Chatbot, Worker, testing |

## Giấy phép

MIT. Dữ liệu chỉ mang tính tham khảo, giá và giờ mở cửa có thể thay đổi. Bản đồ © OpenStreetMap contributors.
