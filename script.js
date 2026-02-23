// ---------------------------
// Safety & Crime (UI/UX baseline + Leaflet map)
// Mock data now; API later.
// ---------------------------

const zipInput = document.getElementById("zipInput");
const zipError = document.getElementById("zipError");
const searchBtn = document.getElementById("searchBtn");

const mockToggle = document.getElementById("mockToggle");
const compareToggle = document.getElementById("compareToggle");

const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const sortSelect = document.getElementById("sortSelect");

const emptyState = document.getElementById("emptyState");
const compareHint = document.getElementById("compareHint");
const loadingState = document.getElementById("loadingState");

const resultsEl = document.getElementById("results");
const resultsCountEl = document.getElementById("resultsCount");
const compareSummaryEl = document.getElementById("compareSummary");

const savedZipsEl = document.getElementById("savedZips");

const legendBtn = document.getElementById("legendBtn");
const centerBtn = document.getElementById("centerBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const legendEl = document.getElementById("legend");
const mapEl = document.getElementById("map");

const trendCanvas = document.getElementById("trendChart");
const trendCtx = trendCanvas?.getContext?.("2d");

// State
let useMockData = true;
let compareMode = false;

let historyZips = [];
let savedZips = [];
let results = [];
let expanded = new Set();

// Map state (Leaflet)
let map = null;
let mapMarker = null;
let mapCircle = null;
let lastLatLng = null; // {lat,lng}
const DEFAULT_CENTER = { lat: 29.7604, lng: -95.3698 }; // Houston

// ---------------------------
// Helpers
// ---------------------------

function setInlineError(msg) {
  if (!msg) {
    zipError.classList.add("hidden");
    zipError.textContent = "";
    return;
  }
  zipError.textContent = msg;
  zipError.classList.remove("hidden");
}

function isValidZip(zip) {
  return /^\d{5}$/.test(zip);
}

function showLoading(show) {
  loadingState.classList.toggle("hidden", !show);
}

function setEmptyStateText(text) {
  emptyState.textContent = text;
}

function showEmptyState(show) {
  emptyState.classList.toggle("hidden", !show);
}

function showCompareHint(show) {
  compareHint.classList.toggle("hidden", !show);
}

function showCompareSummary(show, text = "") {
  compareSummaryEl.classList.toggle("hidden", !show);
  compareSummaryEl.innerHTML = text;
}

function updateCounts() {
  resultsCountEl.textContent = String(results.length);
}

function safetyBand(score) {
  if (score >= 70) return { label: "Safer", cls: "safe" };
  if (score >= 45) return { label: "Medium", cls: "medium" };
  return { label: "Higher risk", cls: "risk" };
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------------------
// Mock Data (now includes mock lat/lng around Houston)
// ---------------------------

function mockZipData(zip) {
  const seed = Number(zip) % 997;

  const safety = clamp(25 + (seed % 76), 0, 100);
  const violent = clamp((seed % 90) / 10, 0, 10);
  const property = clamp(((seed * 7) % 220) / 10, 0, 22);

  const confidence = clamp(55 + (seed % 40), 0, 100);

  // mock “trend”
  const t1 = clamp(safety - (seed % 8), 0, 100);
  const t2 = clamp(safety + ((seed % 11) - 5), 0, 100);
  const t3 = clamp(safety + ((seed % 9) - 4), 0, 100);
  const t4 = clamp(safety + ((seed % 13) - 6), 0, 100);

  // mock coords: slight offsets around Houston so the map moves per ZIP
  const latOffset = ((seed % 100) - 50) * 0.0012;  // ~±0.06
  const lngOffset = (((seed * 3) % 100) - 50) * 0.0015; // ~±0.075
  const lat = DEFAULT_CENTER.lat + latOffset;
  const lng = DEFAULT_CENTER.lng + lngOffset;

  return {
    zip,
    city: "Houston Area (Mock)",
    state: "TX",
    safetyScore: safety,
    confidence,
    metrics: {
      violentRate: violent.toFixed(1),
      propertyRate: property.toFixed(1),
      overallIndex: (100 - safety).toFixed(0)
    },
    notes: [
      "Mock dataset: replace with FBI/API values later.",
      "This is a UI/UX baseline so pages feel real before live data."
    ],
    trend: [t1, t2, t3, t4],
    location: { lat, lng }
  };
}

// ---------------------------
// Fetch Layer (Mock now, API later)
// ---------------------------

async function fetchZipData(zip) {
  if (useMockData) {
    await sleep(450);
    return mockZipData(zip);
  }
  // Later: plug FBI/other API calls here.
  throw new Error("Live API mode not configured yet.");
}

// ---------------------------
// Leaflet Map
// ---------------------------

function initLeafletMap() {
  if (map) return;
  if (!window.L) {
    // Leaflet script is deferred; it should exist after load
    console.warn("Leaflet not loaded yet.");
    return;
  }

  map = L.map("map", { zoomControl: true }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // default marker
  mapMarker = L.marker([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]).addTo(map)
    .bindPopup("Houston (default)");

  // default circle (neutral)
  mapCircle = L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
    radius: 1800,
    color: "rgba(154,166,178,.85)",
    weight: 2,
    fillColor: "rgba(154,166,178,.20)",
    fillOpacity: 0.25
  }).addTo(map);

  lastLatLng = { ...DEFAULT_CENTER };

  // Fix tiles on resize
  window.addEventListener("resize", () => {
    try { map.invalidateSize(); } catch {}
  });

  document.addEventListener("fullscreenchange", () => {
    // Leaflet needs invalidateSize after fullscreen changes
    setTimeout(() => {
      try { map.invalidateSize(); } catch {}
    }, 120);
  });
}

function colorForBand(bandCls) {
  if (bandCls === "safe") return { stroke: "rgba(0,185,107,0.95)", fill: "rgba(0,185,107,0.20)" };
  if (bandCls === "medium") return { stroke: "rgba(247,201,72,0.95)", fill: "rgba(247,201,72,0.18)" };
  return { stroke: "rgba(255,77,77,0.95)", fill: "rgba(255,77,77,0.16)" };
}

function updateMapForResult(r) {
  if (!r?.location) return;
  initLeafletMap();
  if (!map) return;

  const { lat, lng } = r.location;
  lastLatLng = { lat, lng };

  const band = safetyBand(r.safetyScore);
  const colors = colorForBand(band.cls);

  // update marker
  if (!mapMarker) {
    mapMarker = L.marker([lat, lng]).addTo(map);
  } else {
    mapMarker.setLatLng([lat, lng]);
  }
  mapMarker.bindPopup(`${r.zip} • ${band.label} (${r.safetyScore})`).openPopup();

  // update circle
  if (!mapCircle) {
    mapCircle = L.circle([lat, lng], { radius: 1800 }).addTo(map);
  } else {
    mapCircle.setLatLng([lat, lng]);
  }
  mapCircle.setStyle({
    color: colors.stroke,
    fillColor: colors.fill,
    fillOpacity: 0.25,
    weight: 2
  });

  // recenter
  map.setView([lat, lng], Math.max(map.getZoom(), 11), { animate: true });
  setTimeout(() => {
    try { map.invalidateSize(); } catch {}
  }, 60);
}

// ---------------------------
// Rendering (Saved + Results)
// ---------------------------

function renderSavedChips() {
  savedZipsEl.innerHTML = "";

  if (savedZips.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted small";
    empty.textContent = "None yet — search a ZIP to save it.";
    savedZipsEl.appendChild(empty);
    return;
  }

  for (const zip of savedZips) {
    const chip = document.createElement("div");
    chip.className = "saved-chip";
    chip.innerHTML = `<span>${zip}</span> <span class="muted small">↩</span>`;
    chip.addEventListener("click", () => runSearch(zip));
    savedZipsEl.appendChild(chip);
  }
}

function skeletonCard() {
  const div = document.createElement("div");
  div.className = "result-card skeleton";
  div.innerHTML = `
    <div class="result-top">
      <div>
        <div style="height:14px;width:90px;border-radius:8px;background:rgba(255,255,255,.06)"></div>
        <div style="height:10px;width:140px;margin-top:8px;border-radius:8px;background:rgba(255,255,255,.05)"></div>
      </div>
      <div style="height:22px;width:82px;border-radius:999px;background:rgba(255,255,255,.06)"></div>
    </div>
    <div class="metrics">
      <div class="metric">
        <div style="height:10px;width:70px;border-radius:8px;background:rgba(255,255,255,.05)"></div>
        <div style="height:14px;width:40px;margin-top:8px;border-radius:8px;background:rgba(255,255,255,.06)"></div>
      </div>
      <div class="metric">
        <div style="height:10px;width:70px;border-radius:8px;background:rgba(255,255,255,.05)"></div>
        <div style="height:14px;width:40px;margin-top:8px;border-radius:8px;background:rgba(255,255,255,.06)"></div>
      </div>
      <div class="metric">
        <div style="height:10px;width:70px;border-radius:8px;background:rgba(255,255,255,.05)"></div>
        <div style="height:14px;width:40px;margin-top:8px;border-radius:8px;background:rgba(255,255,255,.06)"></div>
      </div>
    </div>
  `;
  return div;
}

function renderResults() {
  resultsEl.innerHTML = "";
  updateCounts();

  if (results.length === 0) {
    showEmptyState(true);

    if (compareMode) {
      setEmptyStateText("Compare Mode is ON. Search at least 2 ZIP codes to compare.");
    } else {
      setEmptyStateText("Enter a ZIP code to view results.");
    }

    showCompareSummary(false);
    return;
  }

  showEmptyState(false);

  // Compare summary
  if (compareMode && results.length >= 2) {
    const avgSafety = Math.round(results.reduce((a, r) => a + r.safetyScore, 0) / results.length);
    const best = [...results].sort((a,b)=>b.safetyScore - a.safetyScore)[0];
    const worst = [...results].sort((a,b)=>a.safetyScore - b.safetyScore)[0];

    showCompareSummary(true, `
      <b>Comparison:</b> Avg safety <b>${avgSafety}</b>.
      Best: <b>${best.zip}</b> (${best.safetyScore}).
      Highest risk: <b>${worst.zip}</b> (${worst.safetyScore}).
    `);
  } else {
    showCompareSummary(false);
  }

  for (const r of results) {
    const band = safetyBand(r.safetyScore);
    const isOpen = expanded.has(r.zip);

    const card = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-top">
        <div>
          <div class="result-zip">${r.zip}</div>
          <div class="result-sub">${r.city}, ${r.state} • Confidence ${r.confidence}%</div>
        </div>
        <div class="badge ${band.cls}">${band.label}</div>
      </div>

      <div class="metrics">
        <div class="metric">
          <div class="k">Safety</div>
          <div class="v">${r.safetyScore}</div>
        </div>
        <div class="metric">
          <div class="k">Violent</div>
          <div class="v">${r.metrics.violentRate}</div>
        </div>
        <div class="metric">
          <div class="k">Property</div>
          <div class="v">${r.metrics.propertyRate}</div>
        </div>
      </div>

      ${isOpen ? `
        <div class="details">
          <b>Notes</b>
          <ul>
            ${r.notes.map(n => `<li>${escapeHtml(n)}</li>`).join("")}
          </ul>
          <div><b>Spec-style checks (example):</b> data validity, missing fields, out-of-range values, and inconsistent totals.</div>
        </div>
      ` : ""}

      <button class="btn ghost details-toggle" data-zip="${r.zip}">
        ${isOpen ? "Hide details" : "Show details"}
      </button>
    `;

    resultsEl.appendChild(card);
  }

  resultsEl.querySelectorAll(".details-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const zip = btn.getAttribute("data-zip");
      if (!zip) return;
      if (expanded.has(zip)) expanded.delete(zip);
      else expanded.add(zip);
      renderResults();
    });
  });
}

// ---------------------------
// Sorting
// ---------------------------

function sortResults() {
  const mode = sortSelect.value;
  const copy = [...results];

  if (mode === "safety_desc") copy.sort((a,b)=> b.safetyScore - a.safetyScore);
  if (mode === "safety_asc") copy.sort((a,b)=> a.safetyScore - b.safetyScore);
  if (mode === "zip_asc") copy.sort((a,b)=> a.zip.localeCompare(b.zip));
  if (mode === "zip_desc") copy.sort((a,b)=> b.zip.localeCompare(a.zip));

  results = copy;
  renderResults();
}

// ---------------------------
// Trend chart placeholder (Canvas)
// ---------------------------

function renderTrend() {
  if (!trendCtx) return;

  let series = [50,55,52,58];
  if (results.length === 1) series = results[0].trend;
  if (results.length >= 2) {
    const sum = [0,0,0,0];
    for (const r of results) for (let i=0;i<4;i++) sum[i] += r.trend[i];
    series = sum.map(v => Math.round(v / results.length));
  }

  const labels = ["2021","2022","2023","2024"];
  const w = trendCanvas.width = trendCanvas.clientWidth * devicePixelRatio;
  const h = trendCanvas.height = (trendCanvas.clientHeight || 90) * devicePixelRatio;

  trendCtx.clearRect(0,0,w,h);

  trendCtx.globalAlpha = 1;
  trendCtx.lineWidth = 1 * devicePixelRatio;
  trendCtx.strokeStyle = "rgba(255,255,255,.08)";
  for (let i=1;i<=3;i++){
    const y = (h/4)*i;
    trendCtx.beginPath();
    trendCtx.moveTo(0,y);
    trendCtx.lineTo(w,y);
    trendCtx.stroke();
  }

  const pad = 18 * devicePixelRatio;
  const min = 0, max = 100;
  const xStep = (w - pad*2) / (series.length - 1);
  const toY = (v) => {
    const t = (v - min) / (max - min);
    return (h - pad) - t * (h - pad*2);
  };

  const pts = series.map((v,i)=>({ x: pad + i*xStep, y: toY(v) }));

  trendCtx.strokeStyle = "rgba(0,185,107,.85)";
  trendCtx.lineWidth = 2.5 * devicePixelRatio;
  trendCtx.beginPath();
  trendCtx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++) trendCtx.lineTo(pts[i].x, pts[i].y);
  trendCtx.stroke();

  trendCtx.fillStyle = "rgba(0,185,107,1)";
  for (const p of pts){
    trendCtx.beginPath();
    trendCtx.arc(p.x,p.y, 3.3*devicePixelRatio, 0, Math.PI*2);
    trendCtx.fill();
  }

  trendCtx.fillStyle = "rgba(154,166,178,.8)";
  trendCtx.font = `${12*devicePixelRatio}px ui-sans-serif, system-ui`;
  trendCtx.textAlign = "center";
  labels.forEach((lab,i)=> trendCtx.fillText(lab, pts[i].x, h - 6*devicePixelRatio));
}

// ---------------------------
// Core action: Search
// ---------------------------

async function runSearch(zipRaw) {
  const zip = String(zipRaw || "").trim();
  setInlineError("");

  if (!isValidZip(zip)) {
    setInlineError("Please enter a valid 5-digit ZIP code.");
    return;
  }

  showCompareHint(compareMode);

  showLoading(true);
  resultsEl.innerHTML = "";
  resultsEl.appendChild(skeletonCard());
  resultsEl.appendChild(skeletonCard());

  try {
    const data = await fetchZipData(zip);

    historyZips.push(zip);

    if (!savedZips.includes(zip)) savedZips.push(zip);
    renderSavedChips();

    if (compareMode) {
      const already = results.some(r => r.zip === zip);
      if (!already) results.push(data);
      else results = results.map(r => r.zip === zip ? data : r);
    } else {
      results = [data];
      expanded.clear();
    }

    sortResults();
    renderTrend();

    // Update map to show searched ZIP (mock coords now; real coords later)
    updateMapForResult(data);

  } catch (err) {
    console.error(err);
    results = [];
    renderResults();
    renderTrend();
    setInlineError("Could not fetch data right now. Try again (or keep Mock Mode on).");
  } finally {
    showLoading(false);
  }
}

// ---------------------------
// Clear actions
// ---------------------------

function clearHistory() {
  historyZips = [];
  setInlineError("");
}

function clearAll() {
  historyZips = [];
  savedZips = [];
  results = [];
  expanded.clear();

  renderSavedChips();
  renderResults();
  renderTrend();
  setInlineError("");
}

// ---------------------------
// Map controls
// ---------------------------

legendBtn.addEventListener("click", () => {
  legendEl.classList.toggle("hidden");
});

centerBtn.addEventListener("click", () => {
  initLeafletMap();
  if (!map) return;

  const c = lastLatLng || DEFAULT_CENTER;
  map.setView([c.lat, c.lng], Math.max(map.getZoom(), 11), { animate: true });
  setTimeout(() => { try { map.invalidateSize(); } catch {} }, 60);
});

fullscreenBtn.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await mapEl.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (e) {
    console.warn("Fullscreen not supported/blocked:", e);
  }
});

// ---------------------------
// Events
// ---------------------------

searchBtn.addEventListener("click", () => runSearch(zipInput.value));
zipInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(zipInput.value); });

mockToggle.addEventListener("change", () => {
  useMockData = mockToggle.checked;
  setInlineError("");
});

compareToggle.addEventListener("change", () => {
  compareMode = compareToggle.checked;
  showCompareHint(compareMode);

  if (!compareMode && results.length > 1) {
    results = [results[results.length - 1]];
    expanded.clear();
  }

  renderResults();
  renderTrend();

  // Optional: center on last result when compare toggles off
  if (results.length === 1) updateMapForResult(results[0]);
});

sortSelect.addEventListener("change", () => {
  sortResults();
  renderTrend();
});

clearHistoryBtn.addEventListener("click", () => {
  clearHistory();
  setInlineError("History cleared (saved ZIPs remain).");
  setTimeout(()=>setInlineError(""), 1200);
});

clearAllBtn.addEventListener("click", () => {
  clearAll();
  setEmptyStateText("Enter a ZIP code to view results.");
  showEmptyState(true);
});

// ---------------------------
// Initial paint
// ---------------------------

(function init(){
  useMockData = mockToggle.checked;
  compareMode = compareToggle.checked;

  renderSavedChips();
  renderResults();
  renderTrend();

  // Init map once on load (Leaflet script is deferred)
  window.addEventListener("load", () => {
    initLeafletMap();
  });
})();
