// ---------------------------
// Config
// ---------------------------
const MAX_HISTORY = 10;

// ⚠️ MVP: This exposes your key in the browser. Later we’ll proxy via Cloudflare Worker.
const FBI_BASE = "https://api.usa.gov/crime/fbi/sapi"; // public base used by CDE frontend :contentReference[oaicite:3]{index=3}

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
  return "🔴";
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
    btn.onclick = () => searchZip(zip);
    historyDiv.appendChild(btn);
  });
}

// ---------------------------
// ZIP -> location (Zippopotam.us) :contentReference[oaicite:4]{index=4}
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
// FBI: State Estimates (free w/ key) :contentReference[oaicite:5]{index=5}
// ---------------------------
async function fetchFbiStateEstimates(stateAbbr) {
  if (!FBI_API_KEY || FBI_API_KEY.includes("PASTE_")) {
    throw new Error("Missing FBI API key");
  }

  const endYear = new Date().getFullYear() - 1;      // last completed year
  const startYear = endYear - 4;                     // last 5 years
  const url =
    `${FBI_BASE}/api/estimates/states/${encodeURIComponent(stateAbbr)}/${startYear}/${endYear}?API_KEY=${encodeURIComponent(FBI_API_KEY)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("FBI estimates fetch failed");

  const json = await res.json();
  const results = json.results || [];

  // Pick the latest year entry available
  results.sort((a, b) => (b.year || 0) - (a.year || 0));
  const latest = results[0];
  if (!latest) throw new Error("No FBI results");

  // The estimates endpoint typically includes rates per 100k for violent/property
  // Field names can vary; we try common ones.
  const violentRate =
    latest.violent_crime_rate ??
    latest.violent_crime?.rate ??
    latest.violent_rate ??
    null;

  const propertyRate =
    latest.property_crime_rate ??
    latest.property_crime?.rate ??
    latest.property_rate ??
    null;

  const year = latest.year ?? endYear;

  return {
    year,
    violentRate: violentRate !== null ? Number(violentRate) : null,
    propertyRate: propertyRate !== null ? Number(propertyRate) : null,
    raw: latest
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
    console.warn("Leaflet not loaded. Check Leaflet <script> tags in index.html.");
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
  if (marker) {
    setTimeout(() => marker.openPopup(), 250);
  }
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
    <div class="card-topline">
      <h3>${cityLine}</h3>
      <a href="#" class="view-on-map" data-zip="${zip}">📍 View on map</a>
    </div>

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

    <div class="card-foot muted">
      ${sourceLine} ${year ? `• ${year}` : ""}
    </div>
  `;
}

function attachCardInteractions(card, zip, lat, lng) {
  // Clicking card focuses map
  card.addEventListener("click", (e) => {
    // Allow remove button / link to handle themselves
    const t = e.target;
    if (t && (t.classList.contains("remove-card-btn") || t.classList.contains("view-on-map"))) return;
    focusZipOnMap(zip, lat, lng);
  });

  // "View on map" link
  const viewLink = card.querySelector(".view-on-map");
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

  // Make a temporary loading card
  const card = document.createElement("div");
  card.className = "result-card";
  if (compareMode) card.classList.add("compare-card");
  card.innerHTML = `<h3>Loading ${zip}…</h3><p class="muted">Fetching ZIP + FBI data…</p>`;
  resultDiv.appendChild(card);
  setTimeout(() => card.classList.add("show"), 30);

  try {
    // ZIP -> location
    const zipInfo = await lookupZip(zip);

    // FBI state estimates
    const est = await fetchFbiStateEstimates(zipInfo.state);

    const violentLevel = rateToLevel(est.violentRate, "violent");
    const propertyLevel = rateToLevel(est.propertyRate, "property");
    const safetyScore = ratesToSafetyScore(est.violentRate, est.propertyRate);
    const safetyColor = safetyColorFromScore(safetyScore);

    const cityLine = `${zipInfo.city}, ${zipInfo.state} (${zip})`;
    const sourceLine = `Source: FBI Crime Data API (state estimates)`;

    // Fill card with real data
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
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        resultDiv.removeChild(card);
        const idx = searchedZips.indexOf(zip);
        if (idx > -1) searchedZips.splice(idx, 1);

        // remove marker too
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

    // Make card clickable to focus map
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

    // Save history
    saveToHistory(zip);

  } catch (err) {
    console.error(err);
    card.innerHTML = `
      <h3>${zip} — Couldn’t load</h3>
      <p class="muted">Try again, or check console for details.</p>
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

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      document.getElementById("result").innerHTML = "";
      searchedZips.length = 0;

      // clear markers
      if (markersLayer) markersLayer.clearLayers();
      for (const k of Object.keys(markerByZip)) delete markerByZip[k];
    });
  }

  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      localStorage.removeItem("zipHistory");
      renderHistory();
    });
  }

  const compareCheckbox = document.getElementById("compareModeCheckbox");
  if (compareCheckbox) {
    compareCheckbox.addEventListener("change", (e) => {
      compareMode = e.target.checked;
      document.getElementById("result").classList.toggle("compare-layout", compareMode);
    });
  }
});
