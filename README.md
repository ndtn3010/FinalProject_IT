# Hà Nội Guide 🏮

**Bài tập cuối kì nhóm 2: Trang web du lịch Hà Nội.**
Gồm lịch sử Thăng Long, địa điểm tham quan, quán ăn ngon, khách sạn và công cụ lên lịch trình kèm bản đồ, thời tiết và chất lượng không khí.
Viết bằng HTML, CSS, JavaScript thuần (không framework), tiếng Việt, giao diện tối, dùng API miễn phí.

**Live demo:** https://ndtn3010.github.io/FinalProject_IT/

## Tính năng

| Module | Mô tả |
|---|---|
| Trang chủ | Hero, thời tiết + AQI Hà Nội (Open-Meteo), địa điểm nổi bật, ẩm thực, lịch trình mẫu |
| Lịch sử | Timeline 9 mốc Thăng Long → Hà Nội. Bấm vào một mốc để mở cửa sổ chi tiết: ảnh, thời gian / nhân vật / địa điểm, 3 đoạn kể bối cảnh, diễn biến, ý nghĩa và một fun fact; chuyển mốc trước / sau ngay trong cửa sổ |
| Địa điểm | 12 địa điểm có ảnh Wikimedia, tìm kiếm (không phân biệt dấu), chỉ đường Google Maps, thêm vào lịch trình |
| Ẩm thực | 23 quán có ảnh món, tìm kiếm theo tên quán / món, nút Google Maps / GrabFood / ShopeeFood mở thẳng trang tìm kiếm tên quán |
| Lịch trình | Kéo-thả (SortableJS), tính chi phí + thời gian, cảnh báo ngày quá dày, mở tuyến đường Google Maps, nạp lịch trình mẫu. Cửa sổ nổi trên mọi trang với bản đồ Leaflet/OSM, danh sách điểm theo ngày, xoá nhanh |
| Khách sạn | Danh sách 25 khách sạn / hostel / homestay; nút Booking.com / Agoda / Traveloka / Google Hotels |

## Cấu trúc

```
index.html            Trang chủ
pages/                places, food, hotels, itinerary, history
css/style.css
js/
  app.js              Chạy trên mọi trang (menu, chuyển trang) rồi gọi file của trang đang mở
  home.js, places.js, food.js, hotels.js, history.js, itinerary.js
                      Mỗi trang một file
  api.js              Tải dữ liệu, Open-Meteo, Wikipedia, link Google Maps / Grab / Booking, Haversine
  storage.js          Lịch trình (localStorage)
  render.js           HTML cho các thẻ địa điểm, món ăn, khách sạn
  trip.js             Cửa sổ nổi lịch trình + bản đồ Leaflet
  utils.js, labels.js Hàm nhỏ dùng chung (tiền, bỏ dấu…) và tên tiếng Việt của các mã
data/                 places.json, foods.json, hotels.json, itineraries.json, history.json
tools/build-pages.mjs Sinh HTML từ layout chung (chạy lại sau khi sửa header/footer)
tools/build-info.mjs  Sinh hanoi-info.txt (bản tổng hợp dữ liệu tiếng Việt) từ data/*.json
tools/serve.mjs       Server tĩnh để chạy local
hanoi-info.txt        Bản tổng hợp dữ liệu (file sinh tự động)
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

Sau khi sửa layout chung trong `tools/build-pages.mjs`, hoặc sửa bất kỳ file nào trong `css/`, `js/`, `data/`:

```bash
node tools/build-pages.mjs
```

Script gắn mã phiên bản (hash nội dung) vào link CSS, JS và JSON (`?v=...`), để người xem tải bản mới ngay sau khi deploy thay vì dùng file cũ trong cache của trình duyệt (GitHub Pages cho cache 10 phút).

Sau khi sửa `data/*.json`, chạy lại `node tools/build-info.mjs` để `hanoi-info.txt` khớp với dữ liệu mới.

## Deploy web lên GitHub Pages

1. Push code lên GitHub.
2. Repo → **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`** → Save.
3. Sau ~1 phút site chạy tại `https://<username>.github.io/<repo>/`.

## Deep link đặt phòng (js/api.js → hotelLinks)

| Nền tảng | URL sinh ra |
|---|---|
| Booking.com | `searchresults.html?ss=<tên>` |
| Agoda | `search?city=2758&textToSearch=<tên>` |
| Traveloka | `hotel/vietnam/region/hanoi-10009843` (trang khách sạn Hà Nội) |
| Google Hotels | `travel/search?q=<tên>` |

Người dùng chọn ngày và số khách ngay trên trang đặt phòng. Nếu `hotels.json` có `links.booking` / `links.agoda`… (trang riêng của khách sạn) thì dùng thẳng link đó.

## API sử dụng

- [Open-Meteo](https://open-meteo.com/) – thời tiết, AQI (không cần key)
- [Wikipedia REST API](https://www.mediawiki.org/wiki/API:REST_API) – ảnh cho địa điểm / quán chưa có ảnh
- Google Maps URLs, GrabFood, ShopeeFood – deep link
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles – bản đồ trong cửa sổ lịch trình
- Browser: localStorage, sessionStorage

## Thành viên

Nhóm 2:

| STT | Họ tên | MSSV |
|---|---|---|
| 1 | Vũ Quang Minh | 26110145 |
| 2 | Nguyễn Đăng Trọng Nghĩa | 26110150 |
| 3 | Văn Phước Vinh | 26110203 |
| 4 | Nguyễn Thanh Nhàn | 26110115 |
| 5 | Vi Phước Thiện | 26110184 |
| 6 | Nguyễn Hoàng | 26110096 |
