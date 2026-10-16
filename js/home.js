// home.js – trang chủ: thời tiết, địa điểm nổi bật, quán ăn, lịch trình mẫu
import { getPlaces, getFoods, getWeather, getAirQuality, weatherIcon, aqiLabel } from './api.js';
import { placeCard, foodCard, skeletonCards, bindAddButtons, loadMissingImages, icon } from './render.js';
import { showSamples } from './itinerary.js';

export async function initHome() {
  showWeather();   // không cần chờ thời tiết xong mới hiện phần khác

  const placesGrid = document.getElementById('home-places');
  const foodRow = document.getElementById('home-food');
  placesGrid.innerHTML = skeletonCards(5);
  foodRow.innerHTML = skeletonCards(3, false);

  // 5 địa điểm đầu tiên
  const places = await getPlaces();
  placesGrid.innerHTML = places.slice(0, 5).map(placeCard).join('');
  bindAddButtons(placesGrid);
  loadMissingImages(placesGrid);

  // 8 quán đầu tiên, vuốt ngang
  const foods = await getFoods();
  foodRow.innerHTML = foods.slice(0, 8).map(foodCard).join('');
  bindAddButtons(foodRow);
  loadMissingImages(foodRow);

  await showSamples(document.getElementById('home-itins'), true);
}

async function showWeather() {
  const box = document.getElementById('weather');
  box.innerHTML = '<p class="muted">Đang tải…</p>';

  try {
    const weather = await getWeather();
    const now = weather.current;

    // AQI lỗi thì vẫn hiện thời tiết, chỉ thiếu dòng AQI
    let aqi = null;
    try {
      const air = await getAirQuality();
      aqi = air.current.us_aqi;
    } catch {
      aqi = null;
    }
    const aqiText = aqi == null
      ? '?'
      : `<span class="aqi ${aqiLabel(aqi).cls}">${aqi} ${aqiLabel(aqi).text}</span>`;

    box.innerHTML = `
      <div class="weather-now">
        <span class="glyph" aria-hidden="true">${weatherIcon(now.weather_code, now.is_day)}</span>
        <div>
          <div class="big">${Math.round(now.temperature_2m)}°C</div>
          <div class="weather-meta">
            <span>Độ ẩm: ${now.relative_humidity_2m}%</span>
            <span>Chất lượng không khí: ${aqiText}</span>
          </div>
        </div>
      </div>
      <div class="weather-days">${forecastDays(weather.daily)}</div>`;
  } catch {
    // mất mạng hoặc Open-Meteo lỗi
    box.innerHTML = '<p class="muted">Không tải được thời tiết</p>';
  }
}

// Dự báo 4 ngày tới (ngày 0 là hôm nay nên bắt đầu từ 1)
function forecastDays(daily) {
  let html = '';
  for (let i = 1; i <= 4; i++) {
    const weekday = new Date(daily.time[i]).toLocaleDateString('vi-VN', { weekday: 'short' });
    const low = Math.round(daily.temperature_2m_min[i]);
    const high = Math.round(daily.temperature_2m_max[i]);
    const rain = daily.precipitation_probability_max[i];
    html += `
      <div class="day">
        <b>${weekday}</b>
        <span class="glyph">${weatherIcon(daily.weather_code[i])}</span>
        <span>${low}° / ${high}°</span>
        <span class="muted">${icon('drop')} ${rain}%</span>
      </div>`;
  }
  return html;
}
