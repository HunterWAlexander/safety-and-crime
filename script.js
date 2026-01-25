// ---------------------------
// Config
// ---------------------------
const MAX_HISTORY = 10;
const WORKER_API_BASE = "https://safety-and-crime-api.hwa95.workers.dev";

// ---------------------------
// Globals
// ---------------------------
const searchedZips = [];
let compareMode = false;

let map;                 // Leaflet map instance
let markersLayer;        // Layer group for markers
const markerByZip = {};  // Track markers so we can focus them later

// ---------------------------
// Helpers
// ---------------------------
function crimeIcon(level) {
  const v = String(level || "").toLowerCase();
  if (v === "low") return "🟢";
  if (v === "medium") return "🟡";
  if (v === "high") return "🔴";
  return "⚪";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safetyColorFromScore(score) {
  if (score >= 80) return "#00b96b";
  if (score >= 60) return "#f1c40f";
  return "#e74c3c";
}

function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString();
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

// ---------------------------
// History (localStorage)
// ---------------------------
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
  const historyDiv = document.getElementById("history");
  if (!historyDiv) return;

  const history = getHistory();
  historyDiv.innerHTML = "";

  history.forEach(zip => {
    const btn = document.createElement("button");
    btn.textContent = zip;
    btn.className = "history-pill";
    btn.type = "button";
    btn.onclick = () => searchZip(zip);
    historyDiv.appendChild(btn);
  });
}

// ---------------------------
// ZIP -> location (Zippopotam.us)
// ---------------------------
async function lookupZip(zip) {
  const url = `https://api.zippopotam.us/us/${encodeURIComponent(zip)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("ZIP lookup failed");

  const data = await res.json();
  const place = data.places?.[0];
  if (!place) throw new Error("ZIP lookup returned no places");

  return {
    zip,
    city: place["place name"],
    state: place["state abbreviation"],
    stateName: place["state"],
    lat: Number(place["latitude"]),
    lng: Number(place["longitude"]),
  };
}

// ---------------------------
// Worker API: State Estimates (via your Worker)
// Returns: { year, violentRate, propertyRate }
// ---------------------------
async function fetchFbiStateEstimates(stateAbbr, zip) {
  const url = `${WORKER_API_BASE}/api/crime?zip=${encodeURIComponent(zip)}&state=${encodeURIComponent(stateAbbr)}`;

  const res = await fetch(url, {
    headers: { "accept": "application/json" }
  });

  const ct = res.headers.get("content-type") || "";

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error("API returned non-JSON (likely HTML). Got: " + text.slice(0, 160));
  }

  const json = await res.json();
  return {
    year: json.year ?? null,
    violentRate: json.violentRate ?? null,
    propertyRate: json.propertyRate ?? null
  };
}

// Convert rates -> friendly Low/Medium/High (simple MVP thresholds)
function rateToLevel(rate, type) {
  if (rate === null || Number.isNaN(rate)) return "Unknown";
  if (type === "violent") {
    if (rate < 250) return "Low";
    if (rate < 450) return "Medium";
    return "High";
  }
  // property
  if (rate < 1800) return "Low";
  if (rate < 3200) return "Medium";
  return "High";
}

// Convert violent/property rates -> 0..100 safety score (heuristic MVP)
function ratesToSafetyScore(violentRate, propertyRate) {
  // Normalize into 0..1 “risk” (bigger rate => bigger risk)
  const v = violentRate === null ? 0.5 : clamp(violentRate / 700, 0, 1);
  const p = propertyRate === null ? 0.5 : clamp(propertyRate / 5000, 0, 1);

  // Weighted: violent matters more
  const risk = (v * 0.6) + (p * 0.4);

  // Safety = inverse risk
  return Math.round(100 - (risk * 100));
}

// ---------------------------
// Map
// ---------------------------
function initMap() {
  const mapEl = document.getElementById("mapContainer");
  if (!mapEl) return;

  if (typeof L === "undefined") {
    console.warn("Leaflet not loaded. Check Leaflet <script> tag in index.html.");
    return;
  }

  map = L.map("mapContainer").setView([37.7749, -95.7129], 4);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function upsertZipMarker(zip, lat, lng, color, popupHtml) {
  if (!map || !markersLayer) return;

  // remove old marker
  if (markerByZip[zip]) {
    markersLayer.removeLayer(markerByZip[zip]);
  }

  const marker = L.circleMarker([lat, lng], {
    radius: 10,
    color,
    fillColor: color,
    fillOpacity: 0.8,
    weight: 2
  }).addTo(markersLayer);

  marker.bindPopup(popupHtml);
  markerByZip[zip] = marker;
}

function focusZipOnMap(zip, lat, lng) {
  if (!map) return;
  map.flyTo([lat, lng], 9, { duration: 0.8 });

  const marker = markerByZip[zip];
  if (marker) setTimeout(() => marker.openPopup(), 250);
}

function centerMapUS() {
  if (!map) return;
  map.flyTo([37.7749, -95.7129], 4, { duration: 0.8 });
}

function toggleLegend() {
  const legend = document.getElementById("mapLegend");
  if (!legend) return;
  legend.classList.toggle("collapsed");
}

function toggleFullscreen() {
  const container = document.getElementById("mapContainer");
  if (!container) return;

  container.classList.toggle("is-fullscreen");
  // Leaflet needs a size invalidation after container changes
  setTimeout(() => {
    if (map) map.invalidateSize(true);
  }, 150);
}

// ---------------------------
// Card UI
// ---------------------------
function buildCardHTML(payload) {
  const {
    zip,
    cityLine,
    violentLevel,
    propertyLevel,
    safetyScore,
    safetyColor,
    sourceLine,
    violentRate,
    propertyRate,
    year
  } = payload;

  return `
    <div class="card-top">
      <div>
        <h3>${cityLine}</h3>
        <div class="zip-badge">${zip}</div>
      </div>
    </div>

    <a href="#" class="view-map-link" data-zip="${zip}">📍 View on map</a>

    <ul>
      <li><strong>Violent Crime:</strong> ${crimeIcon(violentLevel)} ${violentLevel}
        <span class="muted">(rate: ${formatNumber(violentRate)} /100k)</span>
      </li>
      <li><strong>Property Crime:</strong> ${crimeIcon(propertyLevel)} ${propertyLevel}
        <span class="muted">(rate: ${formatNumber(propertyRate)} /100k)</span>
      </li>
      <li><strong>Safety Score:</strong> ${safetyScore}/100</li>
    </ul>

    <div class="safety-bar-container">
      <div class="safety-bar" data-width="${safetyScore}" style="background-color:${safetyColor}"></div>
    </div>

    <div class="muted" style="margin-top:10px;">
      ${sourceLine} ${year ? `• ${year}` : ""}
    </div>
  `;
}

function attachCardInteractions(card, zip, lat, lng) {
  // Clicking card focuses map (except link/button)
  card.addEventListener("click", (e) => {
    const t = e.target;
    if (t && (t.classList.contains("remove-card-btn") || t.classList.contains("view-map-link"))) return;
    focusZipOnMap(zip, lat, lng);
  });

  // "View on map" link
  const viewLink = card.querySelector(".view-map-link");
  if (viewLink) {
    viewLink.addEventListener("click", (e) => {
      e.preventDefault();
      focusZipOnMap(zip, lat, lng);
    });
  }

  // Keyboard access
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View ${zip} on map`);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      focusZipOnMap(zip, lat, lng);
    }
  });
}

// ---------------------------
// Main Search
// ---------------------------
async function searchZip(forcedZip = null) {
  const zip = forcedZip || document.getElementById("zipInput")?.value?.trim();
  const resultDiv = document.getElementById("result");
  if (!zip || !resultDiv) return;

  // Validate ZIP
  if (zip.length !== 5 || isNaN(zip)) {
    alert("Please enter a valid 5-digit ZIP code.");
    return;
  }

  // Block duplicates only in normal mode
  if (!compareMode && searchedZips.includes(zip)) {
    alert("ZIP code already displayed.");
    return;
  }

  // Track displayed zip (once)
  if (!searchedZips.includes(zip)) searchedZips.push(zip);

  // Clear cards in normal mode
  if (!compareMode) resultDiv.innerHTML = "";

  // Loading card
  const card = document.createElement("div");
  card.className = "result-card";
  if (compareMode) card.classList.add("compare-card");
  card.innerHTML = `<h3>Loading ${zip}…</h3><p class="muted">Fetching ZIP + crime data…</p>`;
  resultDiv.appendChild(card);
  setTimeout(() => card.classList.add("show"), 30);

  try {
    // ZIP -> location
    const zipInfo = await lookupZip(zip);

    // Worker estimates
    const est = await fetchFbiStateEstimates(zipInfo.state, zip);

    const violentLevel = rateToLevel(est.violentRate, "violent");
    const propertyLevel = rateToLevel(est.propertyRate, "property");
    const safetyScore = ratesToSafetyScore(est.violentRate, est.propertyRate);
    const safetyColor = safetyColorFromScore(safetyScore);

    const cityLine = `${zipInfo.city}, ${zipInfo.state} (${zip})`;
    const sourceLine = `Source: FBI Crime Data API (state estimates)`;

    // Fill card
    card.innerHTML = buildCardHTML({
      zip,
      cityLine,
      violentLevel,
      propertyLevel,
      safetyScore,
      safetyColor,
      sourceLine,
      violentRate: est.violentRate,
      propertyRate: est.propertyRate,
      year: est.year
    });

    // Remove button in compare mode
    if (compareMode) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "x";
      removeBtn.className = "remove-card-btn";
      removeBtn.title = "Remove card";
      removeBtn.type = "button";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        resultDiv.removeChild(card);
        const idx = searchedZips.indexOf(zip);
        if (idx > -1) searchedZips.splice(idx, 1);

        // remove marker
        if (markerByZip[zip] && markersLayer) {
          markersLayer.removeLayer(markerByZip[zip]);
          delete markerByZip[zip];
        }
      };
      card.appendChild(removeBtn);
    }

    // Animate safety bar
    setTimeout(() => {
      const bar = card.querySelector(".safety-bar");
      if (bar) bar.style.width = bar.dataset.width + "%";
    }, 80);

    // Map marker + popup
    const popupHtml = `
      <strong>${zipInfo.city}, ${zipInfo.state} (${zip})</strong><br>
      Safety Score: ${safetyScore}/100<br>
      Violent rate: ${formatNumber(est.violentRate)} /100k<br>
      Property rate: ${formatNumber(est.propertyRate)} /100k
    `;
    upsertZipMarker(zip, zipInfo.lat, zipInfo.lng, safetyColor, popupHtml);

    attachCardInteractions(card, zip, zipInfo.lat, zipInfo.lng);

    // Sort + highlight in compare mode
    if (compareMode) {
      const cards = Array.from(resultDiv.children);
      cards.sort((a, b) => {
        const aScore = parseInt(a.querySelector(".safety-bar")?.dataset?.width || "0", 10);
        const bScore = parseInt(b.querySelector(".safety-bar")?.dataset?.width || "0", 10);
        return bScore - aScore;
      });

      cards.forEach(c => c.classList.remove("highlight-card"));
      if (cards.length > 0) cards[0].classList.add("highlight-card");
      cards.forEach(c => resultDiv.appendChild(c));
    }

    saveToHistory(zip);
    showToast(`Loaded ${zip}`);

  } catch (err) {
    console.error(err);
    card.innerHTML = `
      <h3>${zip} — Couldn’t load</h3>
      <p class="muted">${String(err?.message || "Try again, or check console for details.")}</p>
    `;
  } finally {
    const input = document.getElementById("zipInput");
    if (input) input.value = "";
  }
}

// ---------------------------
// Page Load Setup
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  initMap();

  // Search button
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => searchZip());
  }

  // Enter key in ZIP input
  const zipInput = document.getElementById("zipInput");
  if (zipInput) {
    zipInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchZip();
    });
  }

  // Clear All
  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const result = document.getElementById("result");
      if (result) result.innerHTML = "";
      searchedZips.length = 0;

      // clear markers
      if (markersLayer) markersLayer.clearLayers();
      for (const k of Object.keys(markerByZip)) delete markerByZip[k];

      showToast("Cleared");
    });
  }

  // Clear History
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      localStorage.removeItem("zipHistory");
      renderHistory();
      showToast("History cleared");
    });
  }

  // Compare mode
  const compareCheckbox = document.getElementById("compareModeCheckbox");
  if (compareCheckbox) {
    compareCheckbox.addEventListener("change", (e) => {
      compareMode = !!e.target.checked;
      const res = document.getElementById("result");
      if (res) res.classList.toggle("compare-layout", compareMode);
      showToast(compareMode ? "Compare mode on" : "Compare mode off");
    });
  }

  // Map controls
  const toggleLegendBtn = document.getElementById("toggleLegendBtn");
  if (toggleLegendBtn) toggleLegendBtn.addEventListener("click", toggleLegend);

  const fullscreenMapBtn = document.getElementById("fullscreenMapBtn");
  if (fullscreenMapBtn) fullscreenMapBtn.addEventListener("click", toggleFullscreen);

  const centerMapBtn = document.getElementById("centerMapBtn");
  if (centerMapBtn) centerMapBtn.addEventListener("click", centerMapUS);
});
