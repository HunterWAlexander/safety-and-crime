// ---------------------------
// Config
// ---------------------------
const MAX_HISTORY = 10;

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

function isValidZip(zip) {
  return /^\d{5}$/.test(zip);
}

// ---------------------------
// History (localStorage)
// ---------------------------
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("zipHistory")) || [];
  } catch {
    return [];
  }
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
// Backend API (Cloudflare Pages Function)
// ---------------------------
async function fetchCrimeFromBackend(zip) {
  // ✅ absolute path prevents /crime/api/... issues
  const url = `/_api/crime?zip=${encodeURIComponent(zip)}&t=${Date.now()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  // If routing breaks, you’ll often get HTML here — show it clearly
  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || `API error (${res.status})`);
    } catch {
      throw new Error(`API error (${res.status}): ${text.slice(0, 120)}`);
    }
  }

  if (!contentType.includes("application/json")) {
    throw new Error("API returned non-JSON (likely HTML). Check routing and _routes.json.");
  }

  return JSON.parse(text);
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
  const v = violentRate === null ? 0.5 : clamp(violentRate / 700, 0, 1);
  const p = propertyRate === null ? 0.5 : clamp(propertyRate / 5000, 0, 1);
  const risk = (v * 0.6) + (p * 0.4);
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
  card.addEventListener("click", (e) => {
    const t = e.target;
    if (t && (t.classList.contains("remove-card-btn") || t.classList.contains("view-on-map"))) return;
    focusZipOnMap(zip, lat, lng);
  });

  const viewLink = card.querySelector(".view-on-map");
  if (viewLink) {
    viewLink.addEventListener("click", (e) => {
      e.preventDefault();
      focusZipOnMap(zip, lat, lng);
    });
  }

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

  if (!isValidZip(zip)) {
    alert("Please enter a valid 5-digit ZIP code.");
    return;
  }

  if (!compareMode && searchedZips.includes(zip)) {
    alert("ZIP code already displayed.");
    return;
  }

  if (!searchedZips.includes(zip)) searchedZips.push(zip);

  if (!compareMode) resultDiv.innerHTML = "";

  const card = document.createElement("div");
  card.className = "result-card";
  if (compareMode) card.classList.add("compare-card");
  card.innerHTML = `<h3>Loading ${zip}…</h3><p class="muted">Fetching ZIP + crime data…</p>`;
  resultDiv.appendChild(card);
  setTimeout(() => card.classList.add("show"), 30);

  try {
    // ZIP -> location (client-side)
    const zipInfo = await lookupZip(zip);

    // Crime rates from backend (server-side should handle FBI key)
    const api = await fetchCrimeFromBackend(zip);

    // We accept either {violentRate, propertyRate, year} or nested fields
    const violentRate = api.violentRate ?? api.violent_rate ?? null;
    const propertyRate = api.propertyRate ?? api.property_rate ?? null;
    const year = api.year ?? null;

    const violentLevel = rateToLevel(violentRate, "violent");
    const propertyLevel = rateToLevel(propertyRate, "property");
    const safetyScore = ratesToSafetyScore(violentRate, propertyRate);
    const safetyColor = safetyColorFromScore(safetyScore);

    const cityLine = `${zipInfo.city}, ${zipInfo.state} (${zip})`;
    const sourceLine = `Source: Safety & Crime API (state estimates)`;

    card.innerHTML = buildCardHTML({
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
      Violent rate: ${formatNumber(violentRate)} /100k<br>
      Property rate: ${formatNumber(propertyRate)} /100k
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

  } catch (err) {
    console.error(err);
    card.innerHTML = `
      <h3>${zip} — Couldn’t load</h3>
      <p class="muted">${String(err?.message || err)}</p>
    `;
  } finally {
    const input = document.getElementById("zipInput");
    if (input) input.value = "";
  }
}

// ---------------------------
// Map Controls (Legend / Fullscreen / Center)
// ---------------------------
function wireMapControls() {
  const legend = document.getElementById("mapLegend");
  const toggleLegendBtn = document.getElementById("toggleLegendBtn");
  if (toggleLegendBtn && legend) {
    toggleLegendBtn.addEventListener("click", () => {
      const isHidden = legend.style.display === "none";
      legend.style.display = isHidden ? "" : "none";
    });
  }

  const centerBtn = document.getElementById("centerMapBtn");
  if (centerBtn) {
    centerBtn.addEventListener("click", () => {
      if (map) map.flyTo([37.7749, -95.7129], 4, { duration: 0.8 });
    });
  }

  const fullscreenBtn = document.getElementById("fullscreenMapBtn");
  const mapContainer = document.getElementById("mapContainer");
  if (fullscreenBtn && mapContainer) {
    fullscreenBtn.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await mapContainer.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
        // Leaflet needs this after resizing
        setTimeout(() => map?.invalidateSize?.(), 200);
      } catch (e) {
        console.warn("Fullscreen not available:", e);
      }
    });
  }
}

// ---------------------------
// Page Load Setup
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  initMap();
  wireMapControls();

  // ✅ FIX: Search button actually triggers searchZip
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => searchZip());
  }

  // ✅ FIX: Enter key triggers search
  const zipInput = document.getElementById("zipInput");
  if (zipInput) {
    zipInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchZip();
      }
    });
  }

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const result = document.getElementById("result");
      if (result) result.innerHTML = "";
      searchedZips.length = 0;

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
      document.getElementById("result")?.classList.toggle("compare-layout", compareMode);
    });
  }
});
