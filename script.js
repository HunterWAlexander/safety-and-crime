// ---------------------------
// Safety & Crime (UI/UX baseline)
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

let historyZips = [];     // Searches performed (displayed results)
let savedZips = [];       // Saved chip list (clickable)
let results = [];         // Result objects
let expanded = new Set(); // expanded card ids

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

// ---------------------------
// Mock Data
// ---------------------------

function mockZipData(zip) {
  // deterministic-ish values from zip string
  const seed = Number(zip) % 997;
  const safety = clamp(25 + (seed % 76), 0, 100);  // 25..100
  const violent = clamp((seed % 90) / 10, 0, 10);  // 0..9.0
  const property = clamp(((seed * 7) % 220) / 10, 0, 22); // 0..22.0

  // fake "confidence"
  const confidence = clamp(55 + (seed % 40), 0, 100);

  // trend placeholder points
  const t1 = clamp(safety - (seed % 8), 0, 100);
  const t2 = clamp(safety + ((seed % 11) - 5), 0, 100);
  const t3 = clamp(safety + ((seed % 9) - 4), 0, 100);
  const t4 = clamp(safety + ((seed % 13) - 6), 0, 100);

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
    trend: [t1, t2, t3, t4]
  };
}

// ---------------------------
// Fetch Layer (Mock now, API later)
// ---------------------------

async function fetchZipData(zip) {
  // Later: plug FBI/other API calls here.
  // For now: mock.
  if (useMockData) {
    await sleep(500);
    return mockZipData(zip);
  }

  // Example placeholder to avoid silent failures
  throw new Error("Live API mode not configured yet.");
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// ---------------------------
// Rendering
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

  // Empty state logic
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

  // Render each result
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

  // Wire detail toggles
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  // pick either last searched zip trend, or average trend
  let series = [50,55,52,58];
  if (results.length === 1) series = results[0].trend;
  if (results.length >= 2) {
    // average trends
    const sum = [0,0,0,0];
    for (const r of results) {
      for (let i=0;i<4;i++) sum[i] += r.trend[i];
    }
    series = sum.map(v => Math.round(v / results.length));
  }

  const labels = ["2021","2022","2023","2024"];
  const w = trendCanvas.width = trendCanvas.clientWidth * devicePixelRatio;
  const h = trendCanvas.height = (trendCanvas.clientHeight || 90) * devicePixelRatio;

  trendCtx.clearRect(0,0,w,h);

  // background grid
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

  // compute points
  const pad = 18 * devicePixelRatio;
  const min = 0, max = 100;
  const xStep = (w - pad*2) / (series.length - 1);
  const toY = (v) => {
    const t = (v - min) / (max - min);
    return (h - pad) - t * (h - pad*2);
  };

  const pts = series.map((v,i)=>({
    x: pad + i*xStep,
    y: toY(v)
  }));

  // line
  trendCtx.strokeStyle = "rgba(0,185,107,.85)";
  trendCtx.lineWidth = 2.5 * devicePixelRatio;
  trendCtx.beginPath();
  trendCtx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++){
    trendCtx.lineTo(pts[i].x, pts[i].y);
  }
  trendCtx.stroke();

  // dots
  trendCtx.fillStyle = "rgba(0,185,107,1)";
  for (const p of pts){
    trendCtx.beginPath();
    trendCtx.arc(p.x,p.y, 3.3*devicePixelRatio, 0, Math.PI*2);
    trendCtx.fill();
  }

  // labels (light)
  trendCtx.fillStyle = "rgba(154,166,178,.8)";
  trendCtx.font = `${12*devicePixelRatio}px ui-sans-serif, system-ui`;
  trendCtx.textAlign = "center";
  labels.forEach((lab,i)=>{
    trendCtx.fillText(lab, pts[i].x, h - 6*devicePixelRatio);
  });
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

  // Show hints
  if (compareMode) showCompareHint(true);
  else showCompareHint(false);

  // loading + skeleton
  showLoading(true);
  resultsEl.innerHTML = "";
  resultsEl.appendChild(skeletonCard());
  resultsEl.appendChild(skeletonCard());

  try {
    const data = await fetchZipData(zip);

    // add to history
    historyZips.push(zip);

    // save zip chip
    if (!savedZips.includes(zip)) savedZips.push(zip);
    renderSavedChips();

    // update results list:
    // If compare mode -> append (keep multiple)
    // else -> replace results with just the one zip
    if (compareMode) {
      // avoid duplicates in results
      const already = results.some(r => r.zip === zip);
      if (!already) results.push(data);
      else {
        // refresh existing if searched again
        results = results.map(r => r.zip === zip ? data : r);
      }
    } else {
      results = [data];
      expanded.clear();
    }

    sortResults();
    renderTrend();
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
  // history is conceptual here; saved chips remain unless Clear All
  // This button can be repurposed later if you render history UI.
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
// Map controls (placeholder)
// ---------------------------

legendBtn.addEventListener("click", () => {
  legendEl.classList.toggle("hidden");
});

centerBtn.addEventListener("click", () => {
  // placeholder: later hook into map library
  mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
});

fullscreenBtn.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    mapEl.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

// ---------------------------
// Events
// ---------------------------

searchBtn.addEventListener("click", () => runSearch(zipInput.value));

zipInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch(zipInput.value);
});

mockToggle.addEventListener("change", () => {
  useMockData = mockToggle.checked;
  // optional: when switching mock/live, clear inline errors
  setInlineError("");
});

compareToggle.addEventListener("change", () => {
  compareMode = compareToggle.checked;

  // hint text visibility
  showCompareHint(compareMode);

  // If turning OFF compare, keep only the most recent result (or none)
  if (!compareMode && results.length > 1) {
    results = [results[results.length - 1]];
    expanded.clear();
  }

  renderResults();
  renderTrend();
});

sortSelect.addEventListener("change", () => {
  sortResults();
  renderTrend();
});

clearHistoryBtn.addEventListener("click", () => {
  clearHistory();
  // small UX feedback
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
})();
// ---- Leaflet Map Init ----
let map;
let marker;

function initLeafletMap() {
  if (!window.L) {
    console.warn("Leaflet not loaded yet.");
    return;
  }
  if (map) return; // prevent double-init

  // Default view (Houston-ish)
  map = L.map("map", {
    zoomControl: true
  }).setView([29.7604, -95.3698], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  marker = L.marker([29.7604, -95.3698]).addTo(map).bindPopup("Houston (default)");
}

// Call it once on load
window.addEventListener("load", initLeafletMap);
