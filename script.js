// script.js (FULL)

// ---------------------------
// Constants & Globals
// ---------------------------
const MAX_HISTORY = 10;

const DEFAULT_MAP_CENTER = [39.5, -98.35];
const DEFAULT_MAP_ZOOM = 4;
const FOCUS_ZOOM = 10;

// Demo crime data (real crime API later)
const crimeData = {
  "90210": { city: "Beverly Hills, CA", violentCrime: "Low", propertyCrime: "Medium", safetyScore: 82 },
  "10001": { city: "New York, NY", violentCrime: "Medium", propertyCrime: "High", safetyScore: 65 },
  "60614": { city: "Chicago, IL", violentCrime: "Medium", propertyCrime: "Medium", safetyScore: 70 }
};

const searchedZips = [];
let compareMode = false;

// Leaflet
let map = null;
const zipMarkers = new Map(); // zip -> marker

// DOM refs
let zipInput, resultDiv, historyDiv, clearBtn, clearHistoryBtn, compareCheckbox, searchBtn;
let mapContainer, centerMapBtn, toggleLegendBtn, fullscreenMapBtn, mapLegend;

// ---------------------------
// Helpers
// ---------------------------
function crimeIcon(level) {
  const v = String(level).toLowerCase();
  if (v === "low") return "🟢";
  if (v === "medium") return "🟡";
  return "🔴";
}

function safetyColor(score) {
  if (score >= 80) return "#00b96b";
  if (score >= 60) return "#f1c40f";
  return "#e74c3c";
}

function getHistory() {
  return JSON.parse(localStorage.getItem("zipHistory")) || [];
}

function saveToHistory(zip) {
  let history = getHistory();
  history = history.filter(z => z !== zip);
  history.unshift(zip);
  history = history.slice(0, MAX_HISTORY);
  localStorage.setItem("zipHistory", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  historyDiv.innerHTML = "";

  history.forEach(zip => {
    const btn = document.createElement("button");
    btn.className = "history-pill";
    btn.textContent = zip;
    btn.title = `Search ${zip}`;
    btn.onclick = () => searchZip(zip);
    historyDiv.appendChild(btn);
  });
}

function clearAllCards() {
  resultDiv.innerHTML = "";
  searchedZips.length = 0;
}

function highlightTopCardIfCompare() {
  if (!compareMode) return;

  const cards = Array.from(resultDiv.querySelectorAll(".result-card"));
  cards.forEach(c => c.classList.remove("highlight-card"));
  if (cards.length === 0) return;

  cards.sort((a, b) => {
    const aScore = parseInt(a.querySelector(".safety-bar")?.dataset?.width || "0", 10);
    const bScore = parseInt(b.querySelector(".safety-bar")?.dataset?.width || "0", 10);
    return bScore - aScore;
  });

  cards.forEach(c => resultDiv.appendChild(c));
  cards[0].classList.add("highlight-card");
}

// ---------------------------
// Toast
// ---------------------------
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = msg;
  el.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------------------------
// ZIP -> real coordinates (free)
// Zippopotam.us (no key)
// ---------------------------
async function lookupZipGeo(zip) {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) return null;

  const json = await res.json();
  const place = json?.places?.[0];
  if (!place) return null;

  const lat = parseFloat(place.latitude);
  const lon = parseFloat(place.longitude);
  const city = place["place name"];
  const state = place["state abbreviation"];

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon, city, state };
}

// ---------------------------
// Map
// ---------------------------
function mapPulse() {
  if (!mapContainer) return;
  mapContainer.classList.remove("map-pulse");
  void mapContainer.offsetWidth; // force reflow
  mapContainer.classList.add("map-pulse");
  setTimeout(() => mapContainer.classList.remove("map-pulse"), 650);
}

function initMap() {
  if (map) return;

  if (typeof L === "undefined") {
    console.error("Leaflet not loaded. Check Leaflet <script> tags in index.html.");
    toast("Map library failed to load.");
    return;
  }

  map = L.map("mapContainer", {
    zoomControl: true,
    scrollWheelZoom: false
  }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  map.on("click", () => toast("Tip: Click a card or “View on map” to focus a ZIP."));

  setTimeout(() => map.invalidateSize(), 150);
}

function centerMap() {
  initMap();
  if (!map) return;

  map.flyTo(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, {
    animate: true,
    duration: 0.85,
    easeLinearity: 0.25
  });
  mapPulse();
}

function addOrFocusZipMarker(zip, lat, lon, popupHtml, colorHex = "#00b96b") {
  if (!map) return;

  if (zipMarkers.has(zip)) {
    const mk = zipMarkers.get(zip);
    map.flyTo([lat, lon], FOCUS_ZOOM, { animate: true, duration: 0.85, easeLinearity: 0.25 });
    mk.openPopup();
    mapPulse();
    return;
  }

  const marker = L.circleMarker([lat, lon], {
    radius: 9,
    weight: 2,
    color: colorHex,
    fillColor: colorHex,
    fillOpacity: 0.7
  }).addTo(map);

  marker.bindPopup(popupHtml);
  zipMarkers.set(zip, marker);

  map.flyTo([lat, lon], FOCUS_ZOOM, { animate: true, duration: 0.85, easeLinearity: 0.25 });
  marker.openPopup();
  mapPulse();
}

async function focusZipOnMap(zip, labelForPopup = null, scoreForColor = null) {
  initMap();
  if (!map) return;

  const geo = await lookupZipGeo(zip);
  if (!geo) {
    toast("Couldn’t locate that ZIP to focus the map.");
    return;
  }

  const label = labelForPopup || `${geo.city}, ${geo.state}`;
  const score = Number(scoreForColor);
  const colorHex = Number.isFinite(score) ? safetyColor(score) : "#00b96b";

  addOrFocusZipMarker(
    zip,
    geo.lat,
    geo.lon,
    `<strong>${label}</strong><br/>ZIP: ${zip}`,
    colorHex
  );
}

// ---------------------------
// Main Search
// ---------------------------
async function searchZip(forcedZip = null) {
  const zip = (forcedZip || zipInput.value || "").trim();

  if (zip.length !== 5 || isNaN(zip)) {
    toast("Enter a valid 5-digit ZIP.");
    return;
  }

  saveToHistory(zip);

  if (!compareMode && searchedZips.includes(zip)) {
    toast("That ZIP is already displayed.");
    return;
  }
  if (!searchedZips.includes(zip)) searchedZips.push(zip);

  const geo = await lookupZipGeo(zip);
  if (!geo) {
    toast("Couldn’t locate that ZIP (geo lookup failed).");
    return;
  }

  const data = crimeData[zip] || {
    city: `${geo.city}, ${geo.state}`,
    violentCrime: "—",
    propertyCrime: "—",
    safetyScore: 0
  };

  const scoreNum = Number(data.safetyScore || 0);
  const barColor = safetyColor(scoreNum);

  const card = document.createElement("div");
  card.className = "result-card";

  card.innerHTML = `
    <div class="card-top">
      <h3>${data.city}</h3>
      <div class="zip-badge">${zip}</div>
    </div>

    <ul>
      <li><strong>Violent Crime:</strong> ${data.violentCrime === "—" ? "—" : `${crimeIcon(data.violentCrime)} ${data.violentCrime}`}</li>
      <li><strong>Property Crime:</strong> ${data.propertyCrime === "—" ? "—" : `${crimeIcon(data.propertyCrime)} ${data.propertyCrime}`}</li>
      <li><strong>Safety Score:</strong> ${data.safetyScore ? `${data.safetyScore}/100` : "—"}</li>
      <li class="muted"><strong>Geo:</strong> ${geo.city}, ${geo.state}</li>
    </ul>

    <a href="#" class="view-map-link" title="Centers map on this ZIP" aria-label="Centers map on this ZIP">📍 View on map</a>

    <div class="safety-bar-container">
      <div class="safety-bar" data-width="${scoreNum}" style="background-color:${barColor}"></div>
    </div>
  `;

  if (compareMode) card.classList.add("compare-card");

  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View ${zip} on map`);
  card.style.cursor = "pointer";

  card.addEventListener("click", () => focusZipOnMap(zip, data.city, scoreNum));

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      focusZipOnMap(zip, data.city, scoreNum);
    }
  });

  const viewLink = card.querySelector(".view-map-link");
  viewLink.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    focusZipOnMap(zip, data.city, scoreNum);
  });

  if (compareMode) {
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "x";
    removeBtn.className = "remove-card-btn";
    removeBtn.title = "Remove this card";
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      card.remove();
      const idx = searchedZips.indexOf(zip);
      if (idx > -1) searchedZips.splice(idx, 1);
      highlightTopCardIfCompare();
    };
    card.appendChild(removeBtn);
  }

  if (!compareMode) resultDiv.innerHTML = "";
  resultDiv.appendChild(card);

  const delay = compareMode ? (resultDiv.children.length - 1) * 70 : 0;
  setTimeout(() => card.classList.add("show"), 30 + delay);

  setTimeout(() => {
    const bar = card.querySelector(".safety-bar");
    if (bar) bar.style.width = (bar.dataset.width || "0") + "%";
  }, 120 + delay);

  highlightTopCardIfCompare();

  initMap();
  if (map) {
    addOrFocusZipMarker(
      zip,
      geo.lat,
      geo.lon,
      `<strong>${data.city}</strong><br/>ZIP: ${zip}<br/>Safety Score: ${data.safetyScore ? `${data.safetyScore}/100` : "—"}`,
      barColor
    );
  }

  zipInput.value = "";
}

// ---------------------------
// Fullscreen toggle
// ---------------------------
function toggleFullscreen() {
  mapContainer.classList.toggle("is-fullscreen");
  const isFs = mapContainer.classList.contains("is-fullscreen");
  fullscreenMapBtn.textContent = isFs ? "Exit Fullscreen" : "Fullscreen";
  setTimeout(() => { if (map) map.invalidateSize(); }, 150);
}

// ---------------------------
// Setup
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  zipInput = document.getElementById("zipInput");
  resultDiv = document.getElementById("result");
  historyDiv = document.getElementById("history");
  clearBtn = document.getElementById("clearBtn");
  clearHistoryBtn = document.getElementById("clearHistoryBtn");
  compareCheckbox = document.getElementById("compareModeCheckbox");
  searchBtn = document.getElementById("searchBtn");

  mapContainer = document.getElementById("mapContainer");
  centerMapBtn = document.getElementById("centerMapBtn");
  toggleLegendBtn = document.getElementById("toggleLegendBtn");
  fullscreenMapBtn = document.getElementById("fullscreenMapBtn");
  mapLegend = document.getElementById("mapLegend");

  renderHistory();
  initMap();

  searchBtn.addEventListener("click", () => searchZip());

  zipInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchZip();
  });

  clearBtn.addEventListener("click", () => {
    clearAllCards();
    toast("Cleared cards.");
  });

  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem("zipHistory");
    renderHistory();
    toast("Cleared history.");
  });

  compareCheckbox.addEventListener("change", (e) => {
    compareMode = e.target.checked;
    resultDiv.classList.toggle("compare-layout", compareMode);

    if (!compareMode) {
      const cards = Array.from(resultDiv.querySelectorAll(".result-card"));
      if (cards.length > 1) {
        cards.slice(0, -1).forEach(c => c.remove());
        searchedZips.splice(0, searchedZips.length - 1);
      }
    } else {
      highlightTopCardIfCompare();
    }
    toast(compareMode ? "Compare Mode ON" : "Compare Mode OFF");
  });

  mapContainer.addEventListener("mouseenter", () => mapContainer.classList.add("map-hover"));
  mapContainer.addEventListener("mouseleave", () => mapContainer.classList.remove("map-hover"));

  centerMapBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    centerMap();
  });

  toggleLegendBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    mapLegend.classList.toggle("collapsed");
    toast(mapLegend.classList.contains("collapsed") ? "Legend hidden" : "Legend shown");
  });

  fullscreenMapBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFullscreen();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mapContainer.classList.contains("is-fullscreen")) {
      mapContainer.classList.remove("is-fullscreen");
      fullscreenMapBtn.textContent = "Fullscreen";
      setTimeout(() => { if (map) map.invalidateSize(); }, 150);
    }
  });
});
