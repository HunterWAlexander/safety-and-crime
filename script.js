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

// Simple toast (optional)
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

// ---------------------------
// Status / UI helpers
// ---------------------------
function setStatusPill(text, variant = "default") {
  const el = document.getElementById("statusPill");
  if (!el) return;

  el.textContent = text;
  el.classList.remove("is-loading", "is-error");
  if (variant === "loading") el.classList.add("is-loading");
  if (variant === "error") el.classList.add("is-error");
}

function updateResultsCount() {
  const el = document.getElementById("resultsCount");
  const resultDiv = document.getElementById("result");
  if (!el || !resultDiv) return;

  const cards = resultDiv.querySelectorAll(".result-card:not(.skeleton)");
  const n = cards.length;
  el.textContent = `${n} result${n === 1 ? "" : "s"}`;
}

function getCardScore(card) {
  const w = card.querySelector(".safety-bar")?.dataset?.width;
  const n = parseInt(w || "0", 10);
  return Number.isFinite(n) ? n : 0;
}

function getCardZip(card) {
  return card.querySelector(".view-on-map")?.getAttribute("data-zip") || "";
}

function sortCards(resultDiv, mode) {
  if (!resultDiv) return;
  const cards = Array.from(resultDiv.children).filter(
    c => c.classList.contains("result-card") && !c.classList.contains("skeleton")
  );

  if (mode === "score_desc") cards.sort((a, b) => getCardScore(b) - getCardScore(a));
  if (mode === "score_asc") cards.sort((a, b) => getCardScore(a) - getCardScore(b));
  if (mode === "zip_asc") cards.sort((a, b) => getCardZip(a).localeCompare(getCardZip(b)));

  cards.forEach(c => c.classList.remove("highlight-card"));
  if (cards.length > 0 && mode === "score_desc") cards[0].classList.add("highlight-card");

  cards.forEach(c => resultDiv.appendChild(c));
}

function renderSkeletons(resultDiv, count = 1) {
  const tpl = document.getElementById("cardSkeletonTpl");
  if (!resultDiv || !tpl) return [];
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const n = tpl.content.firstElementChild.cloneNode(true);
    resultDiv.appendChild(n);
    nodes.push(n);
  }
  return nodes;
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
// MOCK DATA ADAPTER (UI/UX first)
// ---------------------------
function hashZip(zip) {
  let h = 0;
  for (let i = 0; i < zip.length; i++) h = (h * 31 + zip.charCodeAt(i)) >>> 0;
  return h;
}

function mockCrimeRates(zip, stateAbbr) {
  const seed = hashZip(`${zip}-${stateAbbr || ""}`);
  const violentRate = clamp(50 + (seed % 900), 50, 900);
  const propertyRate = clamp(600 + ((seed >>> 3) % 5200), 600, 5500);
  const year = 2022;
  return { violentRate, propertyRate, year };
}

async function fetchCrimeStats(zip, stateAbbr) {
  await new Promise(r => setTimeout(r, 450));
  const { violentRate, propertyRate, year } = mockCrimeRates(zip, stateAbbr);
  return { ok: true, zip, state: stateAbbr, year, violentRate, propertyRate, mock: true };
}

// Convert rates -> friendly Low/Medium/High (simple MVP thresholds)
function rateToLevel(rate, type) {
  if (rate === null || Number.isNaN(rate)) return "Unknown";
  if (type === "violent") {
    if (rate < 250) return "Low";
    if (rate < 450) return "Medium";
    return "High";
  }
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
  wireMapControls();
}

function wireMapControls() {
  const legend = document.getElementById("mapLegend");
  const toggleLegendBtn = document.getElementById("toggleLegendBtn");
  if (toggleLegendBtn && legend) {
    toggleLegendBtn.addEventListener("click", () => {
      legend.classList.toggle("collapsed");
    });
  }

  const mapEl = document.getElementById("mapContainer");
  const fullscreenBtn = document.getElementById("fullscreenMapBtn");
  if (fullscreenBtn && mapEl) {
    fullscreenBtn.addEventListener("click", () => {
      mapEl.classList.toggle("is-fullscreen");
      setTimeout(() => {
        if (map) map.invalidateSize(true);
      }, 150);
    });
  }

  const centerBtn = document.getElementById("centerMapBtn");
  if (centerBtn) {
    centerBtn.addEventListener("click", () => {
      if (!map) return;
      map.flyTo([37.7749, -95.7129], 4, { duration: 0.8 });
    });
  }
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
  if (marker) setTimeout(() => marker.openPopup(), 250);
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
    year,
    detailsHtml = ""
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

    <button class="details-toggle" type="button" aria-expanded="false">
      <span class="details-toggle-left">View details</span>
      <span class="chev">▾</span>
    </button>

    <div class="details-panel" hidden>
      ${detailsHtml}
    </div>

    <div class="card-foot muted">
      ${sourceLine} ${year ? `• ${year}` : ""}
    </div>
  `;
}

function attachCardInteractions(card, zip, lat, lng) {
  // Toggle details without triggering map focus
  const toggleBtn = card.querySelector(".details-toggle");
  const panel = card.querySelector(".details-panel");

  if (toggleBtn && panel) {
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = card.classList.toggle("details-open");
      toggleBtn.setAttribute("aria-expanded", String(isOpen));

      if (isOpen) {
        panel.hidden = false;
        panel.style.maxHeight = panel.scrollHeight + "px";
      } else {
        panel.style.maxHeight = panel.scrollHeight + "px";
        requestAnimationFrame(() => {
          panel.style.maxHeight = "0px";
        });
        setTimeout(() => {
          panel.hidden = true;
        }, 220);
      }
    });
  }

  // Card click focuses map (ignore clicks on toggle/panel/link/remove)
  card.addEventListener("click", (e) => {
    const t = e.target;
    if (!t) return;

    if (
      t.classList.contains("remove-card-btn") ||
      t.classList.contains("view-on-map") ||
      t.closest?.(".details-toggle") ||
      t.closest?.(".details-panel")
    ) return;

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

  if (zip.length !== 5 || isNaN(zip)) {
    alert("Please enter a valid 5-digit ZIP code.");
    return;
  }

  if (!compareMode && searchedZips.includes(zip)) {
    alert("ZIP code already displayed.");
    return;
  }

  if (!searchedZips.includes(zip)) searchedZips.push(zip);
  if (!compareMode) resultDiv.innerHTML = "";

  setStatusPill("Loading…", "loading");

  const [skeleton] = renderSkeletons(resultDiv, 1);

  try {
    const zipInfo = await lookupZip(zip);
    const api = await fetchCrimeStats(zip, zipInfo.state);

    const violentLevel = rateToLevel(api.violentRate, "violent");
    const propertyLevel = rateToLevel(api.propertyRate, "property");
    const safetyScore = ratesToSafetyScore(api.violentRate, api.propertyRate);
    const safetyColor = safetyColorFromScore(safetyScore);

    const cityLine = `${zipInfo.city}, ${zipInfo.state} (${zip})`;
    const sourceLine = api.mock ? `Source: Mock data (UI/UX mode)` : `Source: Live data`;

    const detailsHtml = `
      <div class="details-grid">
        <div class="details-row">
          <span class="details-k">State</span>
          <span class="details-v">${zipInfo.stateName || zipInfo.state}</span>
        </div>
        <div class="details-row">
          <span class="details-k">Coordinates</span>
          <span class="details-v">${zipInfo.lat.toFixed(4)}, ${zipInfo.lng.toFixed(4)}</span>
        </div>
        <div class="details-row">
          <span class="details-k">Data note</span>
          <span class="details-v">Mock data for UI/UX (real FBI data later)</span>
        </div>
        <div class="details-row">
          <span class="details-k">Roadmap</span>
          <span class="details-v">Add: FBI + schools + income + housing + flood + more</span>
        </div>
      </div>
    `;

    const card = document.createElement("div");
    card.className = "result-card";
    if (compareMode) card.classList.add("compare-card");
    card.innerHTML = buildCardHTML({
      zip,
      cityLine,
      violentLevel,
      propertyLevel,
      safetyScore,
      safetyColor,
      sourceLine,
      violentRate: api.violentRate,
      propertyRate: api.propertyRate,
      year: api.year,
      detailsHtml
    });

    if (skeleton && skeleton.parentNode) skeleton.parentNode.replaceChild(card, skeleton);
    else resultDiv.appendChild(card);

    setTimeout(() => card.classList.add("show"), 30);

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
        if (markerByZip[zip] && markersLayer) {
          markersLayer.removeLayer(markerByZip[zip]);
          delete markerByZip[zip];
        }
        updateResultsCount();
      };
      card.appendChild(removeBtn);
    }

    setTimeout(() => {
      const bar = card.querySelector(".safety-bar");
      if (bar) bar.style.width = bar.dataset.width + "%";
    }, 80);

    const popupHtml = `
      <strong>${zipInfo.city}, ${zipInfo.state} (${zip})</strong><br>
      Safety Score: ${safetyScore}/100<br>
      Violent rate: ${formatNumber(api.violentRate)} /100k<br>
      Property rate: ${formatNumber(api.propertyRate)} /100k
    `;

    upsertZipMarker(zip, zipInfo.lat, zipInfo.lng, safetyColor, popupHtml);
    attachCardInteractions(card, zip, zipInfo.lat, zipInfo.lng);

    const sortSelect = document.getElementById("sortSelect");
    const mode = sortSelect?.value || "score_desc";
    sortCards(resultDiv, mode);

    saveToHistory(zip);
    updateResultsCount();

    setStatusPill("Mock data mode", "default");
    toast("Loaded (mock) ✅");
  } catch (err) {
    console.error(err);
    if (skeleton && skeleton.parentNode) skeleton.remove();

    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <h3>${zip} — Couldn’t load</h3>
      <p class="muted">${String(err.message || err)}</p>
    `;
    resultDiv.appendChild(card);
    setTimeout(() => card.classList.add("show"), 30);

    updateResultsCount();
    setStatusPill("Error loading ZIP", "error");
    toast("Couldn’t load. Check ZIP / network.");
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

  setStatusPill("Mock data mode", "default");
  updateResultsCount();

  const sortSelect = document.getElementById("sortSelect");
  const resultDiv = document.getElementById("result");
  if (sortSelect && resultDiv) {
    sortSelect.addEventListener("change", () => {
      sortCards(resultDiv, sortSelect.value);
    });
  }

  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.addEventListener("click", () => searchZip());

  const zipInput = document.getElementById("zipInput");
  if (zipInput) {
    zipInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchZip();
    });
  }

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      document.getElementById("result").innerHTML = "";
      searchedZips.length = 0;
      if (markersLayer) markersLayer.clearLayers();
      for (const k of Object.keys(markerByZip)) delete markerByZip[k];

      updateResultsCount();
      setStatusPill("Mock data mode", "default");
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
