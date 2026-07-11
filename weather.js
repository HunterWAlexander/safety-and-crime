// ---------------------------
// Safety & Crime — weather.js
// ZIP → lat/lng (Zippopotam) → NWS forecast (api.weather.gov, no key required)
// ---------------------------

// ── DOM ────────────────────────────────────────────────────────────────
const wZipInput   = document.getElementById("wZipInput");
const wSearchBtn  = document.getElementById("wSearchBtn");
const wZipError   = document.getElementById("wZipError");
const wEmpty      = document.getElementById("wEmpty");
const wLoading    = document.getElementById("wLoading");
const wResults    = document.getElementById("wResults");
const wLocation   = document.getElementById("wLocation");
const wCurrent    = document.getElementById("wCurrent");
const wForecast   = document.getElementById("wForecast");
const wUpdated    = document.getElementById("wUpdated");

// ── ZIP → COORDS (same source as the crime tool) ──────────────────────
async function wFetchZipInfo(zip) {
  const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!r.ok) return null;
  const d = await r.json();
  const place = d?.places?.[0];
  if (!place) return null;
  return {
    city:  place["place name"] ?? "Unknown",
    state: place["state abbreviation"] ?? "",
    lat:   parseFloat(place["latitude"]),
    lng:   parseFloat(place["longitude"]),
  };
}

// ── NWS FORECAST ───────────────────────────────────────────────────────
// Step 1: points endpoint maps coords → that area's forecast grid URL
// Step 2: fetch the actual forecast periods from that URL
async function fetchForecast(lat, lng) {
  const pointsRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`);
  if (!pointsRes.ok) return null;
  const points = await pointsRes.json();
  const forecastUrl = points?.properties?.forecast;
  if (!forecastUrl) return null;

  const fRes = await fetch(forecastUrl);
  if (!fRes.ok) return null;
  const f = await fRes.json();
  const periods = f?.properties?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return null;

  return {
    periods,
    updated: f?.properties?.updateTime ?? null,
  };
}

// ── ICON MAPPING (rough keyword match on NWS shortForecast text) ──────
function forecastEmoji(text, isDaytime) {
  const t = (text || "").toLowerCase();
  if (t.includes("thunder")) return "⛈️";
  if (t.includes("snow") || t.includes("blizzard") || t.includes("flurr")) return "🌨️";
  if (t.includes("sleet") || t.includes("ice") || t.includes("freezing")) return "🧊";
  if (t.includes("rain") || t.includes("shower") || t.includes("drizzle")) return "🌧️";
  if (t.includes("fog") || t.includes("haze") || t.includes("smoke")) return "🌫️";
  if (t.includes("wind") || t.includes("breezy") || t.includes("blustery")) return "💨";
  if (t.includes("partly") || t.includes("mostly sunny") || t.includes("mostly clear")) return isDaytime ? "⛅" : "🌙";
  if (t.includes("cloud") || t.includes("overcast")) return "☁️";
  if (t.includes("sunny") || t.includes("clear") || t.includes("hot")) return isDaytime ? "☀️" : "🌙";
  if (t.includes("cold")) return "🥶";
  return isDaytime ? "🌤️" : "🌙";
}

// ── RENDER ─────────────────────────────────────────────────────────────
function renderWeather(zip, loc, data) {
  const { periods, updated } = data;
  const now = periods[0];
  wxPeriods = periods;

  if (wLocation) wLocation.textContent = `${loc.city}, ${loc.state} — ${zip}`;

  // Current / next period hero card (clickable for full details)
  if (wCurrent) {
    wCurrent.setAttribute("onclick", "openPeriodDetail(0)");
    wCurrent.style.cursor = "pointer";
    wCurrent.title = "Click for full details";
    wCurrent.innerHTML = `
      <div class="w-hero-icon">${forecastEmoji(now.shortForecast, now.isDaytime)}</div>
      <div class="w-hero-main">
        <div class="w-hero-temp">${now.temperature}°${now.temperatureUnit}</div>
        <div class="w-hero-label">${now.name} · ${now.shortForecast}</div>
        <div class="w-hero-detail">${now.detailedForecast || ""}</div>
        <div class="w-hero-meta">
          ${now.windSpeed ? `💨 Wind: ${now.windSpeed} ${now.windDirection || ""}` : ""}
          ${now.probabilityOfPrecipitation?.value != null ? ` · ☔ Precip: ${now.probabilityOfPrecipitation.value}%` : ""}
          · <span style="color:var(--green,#16a34a);font-weight:500;">Tap for details ›</span>
        </div>
      </div>
    `;
  }

  // Remaining periods (skip the first, already shown as hero) — each opens detail modal
  if (wForecast) {
    wForecast.innerHTML = periods.slice(1, 13).map((p, i) => `
      <div class="w-card" onclick="openPeriodDetail(${i + 1})" style="cursor:pointer;" title="Click for full details">
        <div class="w-card-name">${p.name}</div>
        <div class="w-card-icon">${forecastEmoji(p.shortForecast, p.isDaytime)}</div>
        <div class="w-card-temp">${p.temperature}°${p.temperatureUnit}</div>
        <div class="w-card-desc">${p.shortForecast}</div>
        ${p.probabilityOfPrecipitation?.value != null ? `<div class="w-card-precip">☔ ${p.probabilityOfPrecipitation.value}%</div>` : ""}
      </div>
    `).join("");
  }

  if (wUpdated && updated) {
    const d = new Date(updated);
    wUpdated.textContent = `Forecast updated ${d.toLocaleString()} · Source: National Weather Service`;
  }

  if (wEmpty)   wEmpty.style.display = "none";
  if (wLoading) wLoading.style.display = "none";
  if (wResults) wResults.style.display = "block";
}

function showWeatherError(msg) {
  if (wLoading) wLoading.style.display = "none";
  if (wResults) wResults.style.display = "none";
  if (wEmpty) {
    wEmpty.style.display = "block";
    wEmpty.textContent = msg;
  }
}

// ── EXTRAS (Open-Meteo — free, no key): humidity, feels-like, gusts,
// UV, pressure, visibility, sunrise/sunset, plus US AQI ─────────────────
let wxExtras = null;      // open-meteo hourly/daily data
let wxAqi = null;         // open-meteo air quality hourly data
let wxPeriods = [];       // NWS periods saved for the detail modal

async function fetchExtras(lat, lng) {
  wxExtras = null; wxAqi = null;
  try {
    const [fRes, aRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&hourly=relative_humidity_2m,apparent_temperature,wind_gusts_10m,surface_pressure,visibility,uv_index` +
        `&daily=sunrise,sunset,uv_index_max&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=auto&forecast_days=8`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&hourly=us_aqi&timezone=auto`),
    ]);
    if (fRes.ok) wxExtras = await fRes.json();
    if (aRes.ok) wxAqi = await aRes.json();
  } catch (_) { /* extras are a bonus — forecast still works without them */ }
}

// Find the hourly index closest to a period's start (shifted toward midday for day periods)
function hourlyIndexFor(period) {
  if (!wxExtras?.hourly?.time) return -1;
  const start = new Date(period.startTime);
  if (period.isDaytime) start.setHours(Math.max(start.getHours(), 13)); // sample early afternoon for day periods
  const target = start.getTime();
  let best = -1, bestDiff = Infinity;
  wxExtras.hourly.time.forEach((t, i) => {
    const diff = Math.abs(new Date(t).getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return best;
}

function dailyIndexFor(period) {
  if (!wxExtras?.daily?.time) return -1;
  const dateStr = period.startTime.substring(0, 10);
  return wxExtras.daily.time.findIndex(t => t === dateStr);
}

function aqiFor(period) {
  if (!wxAqi?.hourly?.time) return null;
  const idx = (() => {
    const target = new Date(period.startTime).getTime();
    let best = -1, bestDiff = Infinity;
    wxAqi.hourly.time.forEach((t, i) => {
      const diff = Math.abs(new Date(t).getTime() - target);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  })();
  const val = wxAqi.hourly.us_aqi?.[idx];
  return Number.isFinite(val) ? Math.round(val) : null;
}

function aqiLabel(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50)  return { text: "Good", color: "#16a34a" };
  if (aqi <= 100) return { text: "Moderate", color: "#d97706" };
  if (aqi <= 150) return { text: "Unhealthy for Sensitive Groups", color: "#ea580c" };
  if (aqi <= 200) return { text: "Unhealthy", color: "#dc2626" };
  if (aqi <= 300) return { text: "Very Unhealthy", color: "#9333ea" };
  return { text: "Hazardous", color: "#7f1d1d" };
}

function uvLabel(uv) {
  if (uv == null) return null;
  if (uv < 3)  return { text: "Low", color: "#16a34a" };
  if (uv < 6)  return { text: "Moderate", color: "#d97706" };
  if (uv < 8)  return { text: "High", color: "#ea580c" };
  if (uv < 11) return { text: "Very High", color: "#dc2626" };
  return { text: "Extreme", color: "#9333ea" };
}

// Moon phase — classic synodic month calculation, no API needed
function moonPhase(date) {
  const synodic = 29.53058867;
  const known = new Date(Date.UTC(2000, 0, 6, 18, 14)); // known new moon
  const days = (date - known) / 86400000;
  const phase = ((days % synodic) + synodic) % synodic;
  const illum = Math.round((1 - Math.cos((phase / synodic) * 2 * Math.PI)) / 2 * 100);
  let name, emoji;
  if (phase < 1.85)       { name = "New Moon"; emoji = "🌑"; }
  else if (phase < 5.54)  { name = "Waxing Crescent"; emoji = "🌒"; }
  else if (phase < 9.23)  { name = "First Quarter"; emoji = "🌓"; }
  else if (phase < 12.92) { name = "Waxing Gibbous"; emoji = "🌔"; }
  else if (phase < 16.61) { name = "Full Moon"; emoji = "🌕"; }
  else if (phase < 20.30) { name = "Waning Gibbous"; emoji = "🌖"; }
  else if (phase < 23.99) { name = "Last Quarter"; emoji = "🌗"; }
  else if (phase < 27.68) { name = "Waning Crescent"; emoji = "🌘"; }
  else                    { name = "New Moon"; emoji = "🌑"; }
  return { name, emoji, illum };
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// ── DETAIL MODAL ───────────────────────────────────────────────────────
function openPeriodDetail(idx) {
  const p = wxPeriods[idx];
  if (!p) return;

  const hi = hourlyIndexFor(p);
  const di = dailyIndexFor(p);
  const h = wxExtras?.hourly;

  const humidity  = hi >= 0 ? h?.relative_humidity_2m?.[hi] : (p.relativeHumidity?.value ?? null);
  const feelsLike = hi >= 0 ? h?.apparent_temperature?.[hi] : null;
  const gusts     = hi >= 0 ? h?.wind_gusts_10m?.[hi] : null;
  const pressure  = hi >= 0 ? h?.surface_pressure?.[hi] : null;
  const visM      = hi >= 0 ? h?.visibility?.[hi] : null;
  const visMi     = Number.isFinite(visM) ? (visM / 1609.34) : null;
  const uv        = p.isDaytime
    ? (di >= 0 ? wxExtras?.daily?.uv_index_max?.[di] : (hi >= 0 ? h?.uv_index?.[hi] : null))
    : 0;
  const sunrise   = di >= 0 ? wxExtras?.daily?.sunrise?.[di] : null;
  const sunset    = di >= 0 ? wxExtras?.daily?.sunset?.[di] : null;
  const aqi       = aqiFor(p);
  const aqiL      = aqiLabel(aqi);
  const uvL       = uvLabel(uv);
  const moon      = moonPhase(new Date(p.startTime));

  const row = (label, value) =>
    value != null && value !== "" ? `<div class="wd-row"><span>${label}</span><span>${value}</span></div>` : "";

  const modal = document.getElementById("wDetailModal");
  const body  = document.getElementById("wDetailBody");
  if (!modal || !body) return;

  body.innerHTML = `
    <div class="wd-head">
      <div class="wd-icon">${forecastEmoji(p.shortForecast, p.isDaytime)}</div>
      <div>
        <div class="wd-name">${p.name}</div>
        <div class="wd-temp">${p.temperature}°${p.temperatureUnit}${Number.isFinite(feelsLike) ? ` <span class="wd-feels">Feels like ${Math.round(feelsLike)}°</span>` : ""}</div>
        <div class="wd-short">${p.shortForecast}</div>
      </div>
    </div>
    <p class="wd-detail">${p.detailedForecast || ""}</p>
    <div class="wd-grid">
      ${row("💧 Humidity", Number.isFinite(humidity) ? Math.round(humidity) + "%" : null)}
      ${row("💨 Wind", p.windSpeed ? `${p.windSpeed} ${p.windDirection || ""}` : null)}
      ${row("🌬️ Gusts", Number.isFinite(gusts) ? Math.round(gusts) + " mph" : null)}
      ${row("☔ Precip chance", p.probabilityOfPrecipitation?.value != null ? p.probabilityOfPrecipitation.value + "%" : null)}
      ${row("🌡️ Pressure", Number.isFinite(pressure) ? Math.round(pressure) + " hPa" : null)}
      ${row("👁️ Visibility", Number.isFinite(visMi) ? visMi.toFixed(1) + " mi" : null)}
      ${uvL ? row("☀️ UV Index", `<span style="color:${uvL.color};font-weight:600;">${Math.round(uv)} · ${uvL.text}</span>`) : ""}
      ${aqiL ? row("🫁 Air Quality", `<span style="color:${aqiL.color};font-weight:600;">${aqi} · ${aqiL.text}</span>`) : ""}
      ${row("🌅 Sunrise", fmtTime(sunrise))}
      ${row("🌇 Sunset", fmtTime(sunset))}
      ${row(`${moon.emoji} Moon`, `${moon.name} · ${moon.illum}% lit`)}
    </div>
    <div class="wd-source">Extra metrics: Open-Meteo · Forecast: National Weather Service</div>
  `;

  modal.classList.add("open");
}

function closePeriodDetail() {
  document.getElementById("wDetailModal")?.classList.remove("open");
}

document.addEventListener("click", (e) => {
  const modal = document.getElementById("wDetailModal");
  if (modal?.classList.contains("open") && e.target === modal) closePeriodDetail();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePeriodDetail(); });

// ── RADAR MAP (RainViewer — free, no key) ──────────────────────────────
let radarMap = null;
let radarMarker = null;
let radarFrames = [];       // list of {time, path} frames from RainViewer
let radarLayers = {};       // frame path → Leaflet tile layer
let radarIndex = 0;
let radarTimer = null;
let radarPlaying = false;

const wRadarPlayBtn = document.getElementById("wRadarPlay");
const wRadarTimeEl  = document.getElementById("wRadarTime");

async function wReverseGeocodeZip(lat, lng) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.countryCode !== "US") return null;
    const zip = (d?.postcode || "").substring(0, 5);
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch (_) { return null; }
}

function initRadarMap(lat, lng, national = false) {
  const mapEl = document.getElementById("wRadarMap");
  if (!mapEl || typeof L === "undefined") return;

  if (!radarMap) {
    radarMap = L.map("wRadarMap").setView([lat, lng], national ? 4 : 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors · Radar: RainViewer",
    }).addTo(radarMap);
    // Click anywhere on the radar → jump to that area's forecast
    radarMap.on("click", async (e) => {
      const zip = await wReverseGeocodeZip(e.latlng.lat, e.latlng.lng);
      if (zip) {
        if (wZipInput) wZipInput.value = zip;
        searchWeather(zip);
      }
    });
    loadRadarFrames(); // radar tiles are national — load once, valid everywhere
  } else if (!national) {
    radarMap.setView([lat, lng], 7);
  }

  if (!national) {
    if (radarMarker) radarMap.removeLayer(radarMarker);
    radarMarker = L.marker([lat, lng]).addTo(radarMap);
  }
}

async function loadRadarFrames() {
  try {
    stopRadar();
    // Clear any previous frame layers
    Object.values(radarLayers).forEach(layer => radarMap.removeLayer(layer));
    radarLayers = {};
    radarFrames = [];

    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    if (!res.ok) return;
    const data = await res.json();

    // Past radar + short-term nowcast frames, in chronological order
    const past = data?.radar?.past ?? [];
    const nowcast = data?.radar?.nowcast ?? [];
    radarFrames = [...past, ...nowcast];
    if (radarFrames.length === 0) return;

    const host = data.host || "https://tilecache.rainviewer.com";

    // Pre-create a tile layer per frame (opacity 0 until shown).
    // maxNativeZoom caps what we request from RainViewer (their free tiles
    // don't cover high zooms) — beyond it, Leaflet upscales the last
    // supported tiles instead of showing "Zoom Level Not Supported" errors.
    radarFrames.forEach(frame => {
      radarLayers[frame.path] = L.tileLayer(
        `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
        { opacity: 0, zIndex: 400, maxNativeZoom: 7, maxZoom: 18 }
      ).addTo(radarMap);
    });

    // Show the most recent "past" frame by default (last real radar image)
    radarIndex = Math.max(0, past.length - 1);
    showRadarFrame(radarIndex);
  } catch (_) {
    // Radar is a bonus feature — fail silently, forecast still works
  }
}

function showRadarFrame(idx) {
  radarFrames.forEach((frame, i) => {
    const layer = radarLayers[frame.path];
    if (layer) layer.setOpacity(i === idx ? 0.65 : 0);
  });
  const frame = radarFrames[idx];
  if (frame && wRadarTimeEl) {
    const d = new Date(frame.time * 1000);
    const isForecast = idx >= (radarFrames.length - (radarFrames.length - radarFrames.findIndex(f => f.time * 1000 > Date.now())));
    const label = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    wRadarTimeEl.textContent = frame.time * 1000 > Date.now() ? `${label} (forecast)` : label;
  }
}

function playRadar() {
  if (radarFrames.length === 0) return;
  radarPlaying = true;
  if (wRadarPlayBtn) wRadarPlayBtn.textContent = "⏸ Pause";
  radarTimer = setInterval(() => {
    radarIndex = (radarIndex + 1) % radarFrames.length;
    showRadarFrame(radarIndex);
  }, 600);
}

function stopRadar() {
  radarPlaying = false;
  if (wRadarPlayBtn) wRadarPlayBtn.textContent = "▶ Play";
  if (radarTimer) { clearInterval(radarTimer); radarTimer = null; }
}

wRadarPlayBtn?.addEventListener("click", () => {
  radarPlaying ? stopRadar() : playRadar();
});

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchWeather(zip) {
  let q = (zip || wZipInput?.value.trim() || "").toString();
  if (!/^\d{5}$/.test(q) && typeof geoResolveToZip === "function") {
    const resolved = await geoResolveToZip(q);
    if (resolved?.zip) { q = resolved.zip; if (wZipInput) wZipInput.value = q; }
  }
  zip = q;
  if (!/^\d{5}$/.test(zip)) {
    if (wZipError) { wZipError.textContent = "Enter a 5-digit ZIP code or a city name (e.g. Houston, TX)."; wZipError.classList.remove("hidden"); }
    return;
  }
  if (wZipError) { wZipError.textContent = ""; wZipError.classList.add("hidden"); }

  if (wEmpty)   wEmpty.style.display = "none";
  if (wResults) wResults.style.display = "none";
  if (wLoading) wLoading.style.display = "block";

  try {
    const loc = await wFetchZipInfo(zip);
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
      showWeatherError("We couldn't find that ZIP code. Double-check it and try again.");
      return;
    }

    const [data] = await Promise.all([
      fetchForecast(loc.lat, loc.lng),
      fetchExtras(loc.lat, loc.lng),
    ]);
    if (!data) {
      showWeatherError("The National Weather Service doesn't have forecast data for that location right now. Try again in a few minutes.");
      return;
    }

    renderWeather(zip, loc, data);
    // Radar map needs the rendered container to be visible before initializing
    setTimeout(() => {
      initRadarMap(loc.lat, loc.lng);
      if (radarMap) radarMap.invalidateSize();
    }, 100);

    // Keep the URL shareable
    const url = new URL(window.location);
    url.searchParams.set("zip", zip);
    window.history.replaceState({}, "", url);
  } catch (_) {
    showWeatherError("Something went wrong fetching the forecast. Please try again.");
  }
}

// ── EVENTS ─────────────────────────────────────────────────────────────
wSearchBtn?.addEventListener("click", () => searchWeather());
wZipInput?.addEventListener("keydown", e => { if (e.key === "Enter") searchWeather(); });

// Handle ?zip= URL param on page load (deep links from header search / homepage)
window.addEventListener("load", () => {
  // National radar view on page open — search re-centers it
  initRadarMap(39.5, -98.35, true);
  setTimeout(() => radarMap?.invalidateSize(), 200);
  const params = new URLSearchParams(window.location.search);
  const zipParam = params.get("zip");
  if (zipParam && /^\d{5}$/.test(zipParam)) {
    if (wZipInput) wZipInput.value = zipParam;
    searchWeather(zipParam);
  }
});