// Safety & Crime — script.js

const topbar        = document.getElementById("topbar");
const zipInput      = document.getElementById("zipInput");
const zipError      = document.getElementById("zipError");
const searchBtn     = document.getElementById("searchBtn");
const mockToggle    = document.getElementById("mockToggle");
const compareToggle = document.getElementById("compareToggle");
const compareModeCheck = document.getElementById("compareModeCheck");

const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearAllBtn     = document.getElementById("clearAllBtn");
const sortSelect      = document.getElementById("sortSelect");

const emptyState     = document.getElementById("emptyState");
const compareHint    = document.getElementById("compareHint");
const loadingState   = document.getElementById("loadingState");
const statusCard     = document.getElementById("statusCard");

const resultsEl      = document.getElementById("results");
const resultsCountEl = document.getElementById("resultsCount");
const compareSummaryEl = document.getElementById("compareSummary");

const recentSection  = document.getElementById("recentSection");
const recentCards    = document.getElementById("recentCards");
const statSection    = document.getElementById("statSection");

const statSafety    = document.getElementById("statSafety");
const statSafetySub = document.getElementById("statSafetySub");
const statViolent   = document.getElementById("statViolent");
const statProperty  = document.getElementById("statProperty");
const statYear      = document.getElementById("statYear");
const statRisk      = document.getElementById("statRisk");

const legendBtn     = document.getElementById("legendBtn");
const centerBtn     = document.getElementById("centerBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const legendEl      = document.getElementById("legend");

const focusBtnMap   = document.getElementById("focusBtnMap");
const mapCard       = document.getElementById("mapCard");
const mapWrapEl     = document.getElementById("mapWrap");

const fsControlsEl  = document.getElementById("fsControls");
const fsLegendBtn   = document.getElementById("fsLegendBtn");
const fsCenterBtn   = document.getElementById("fsCenterBtn");
const fsExitBtn     = document.getElementById("fsExitBtn");
const fsExitFocusBtn= document.getElementById("fsExitFocusBtn");
const focusExitEl   = document.getElementById("focusExit");
const exitFocusBtn  = document.getElementById("exitFocusBtn");

const trendCanvas   = document.getElementById("trendChart");
const trendCtx      = trendCanvas?.getContext?.("2d");

// State
let useMockData  = true;
let compareMode  = false;
let historyZips  = [];
let savedZips    = [];
let results      = [];
let expanded     = new Set();
let recentData   = []; // full data objects for recent strip

let map, mapMarker, mapCircle, lastLatLng;
const DEFAULT_CENTER = { lat: 29.7604, lng: -95.3698 };

// ── Helpers ────────────────────────────────────────
function setInlineError(msg) {
  if (!msg) { zipError.classList.add("hidden"); zipError.textContent = ""; return; }
  zipError.textContent = msg;
  zipError.classList.remove("hidden");
}
function isValidZip(z) { return /^\d{5}$/.test(z); }
function showLoading(v) { loadingState.classList.toggle("hidden", !v); }
function showEmptyState(v) { emptyState.classList.toggle("hidden", !v); }
function showCompareHint(v) { compareHint.classList.toggle("hidden", !v); }
function showCompareSummary(v, html = "") { compareSummaryEl.classList.toggle("hidden", !v); compareSummaryEl.innerHTML = html; }
function updateCounts() { resultsCountEl.textContent = String(results.length); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}
function setTopbarHeightVar() {
  const h = topbar?.offsetHeight || 68;
  document.documentElement.style.setProperty("--topbar-h", `${h}px`);
}
function clamp(n,a,b) { return Math.max(a, Math.min(b, n)); }

function safetyBand(score) {
  if (score >= 70) return { label: "Low Risk",    cls: "safe",   riskLabel: "Low Risk" };
  if (score >= 45) return { label: "Medium Risk", cls: "medium", riskLabel: "Medium Risk" };
  return { label: "High Risk", cls: "risk", riskLabel: "High Risk" };
}

// ── Mock data ───────────────────────────────────────
function mockZipData(zip) {
  const seed = Number(zip) % 997;
  const safety   = clamp(25 + (seed % 76), 0, 100);
  const violent  = clamp((seed % 90) / 10, 0, 10);
  const property = clamp(((seed * 7) % 220) / 10, 0, 22);
  const confidence = clamp(55 + (seed % 40), 0, 100);
  const t1 = clamp(safety - (seed % 8), 0, 100);
  const t2 = clamp(safety + ((seed % 11) - 5), 0, 100);
  const t3 = clamp(safety + ((seed % 9) - 4), 0, 100);
  const t4 = clamp(safety + ((seed % 13) - 6), 0, 100);
  const latOffset = ((seed % 100) - 50) * 0.0012;
  const lngOffset = (((seed * 3) % 100) - 50) * 0.0015;
  return {
    zip, city: "Houston", state: "TX",
    safetyScore: safety, confidence,
    metrics: {
      violentRate:  violent.toFixed(1),
      propertyRate: property.toFixed(1),
      overallIndex: (100 - safety).toFixed(0)
    },
    notes: [
      "Mock dataset — replace with FBI/API values later.",
      "This is a UI/UX baseline so pages feel real before live data."
    ],
    trend: [t1, t2, t3, t4],
    location: { lat: DEFAULT_CENTER.lat + latOffset, lng: DEFAULT_CENTER.lng + lngOffset }
  };
}

async function fetchZipData(zip) {
  if (useMockData) { await sleep(450); return mockZipData(zip); }
  throw new Error("Live API mode not configured yet.");
}

// ── Leaflet ─────────────────────────────────────────
function initLeafletMap() {
  if (map) return;
  if (!window.L) { console.warn("Leaflet not loaded yet."); return; }
  map = L.map("map", { zoomControl: true }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  mapMarker = L.marker([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]).addTo(map).bindPopup("Houston (default)");
  mapCircle = L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
    radius: 1800, weight: 2,
    color: "rgba(107,114,128,.7)", fillColor: "rgba(107,114,128,.12)", fillOpacity: 0.2
  }).addTo(map);
  lastLatLng = { ...DEFAULT_CENTER };
  window.addEventListener("resize", () => safeInvalidateMap());
  document.addEventListener("fullscreenchange", () => {
    updateFullscreenUI();
    setTimeout(() => safeInvalidateMap(), 140);
  });
}

function safeInvalidateMap() { try { map?.invalidateSize(); } catch {} }

function colorForBand(cls) {
  if (cls === "safe")   return { stroke: "#16a34a", fill: "rgba(22,163,74,.15)" };
  if (cls === "medium") return { stroke: "#d97706", fill: "rgba(217,119,6,.15)" };
  return { stroke: "#dc2626", fill: "rgba(220,38,38,.13)" };
}

function updateMapForResult(r) {
  if (!r?.location) return;
  initLeafletMap();
  if (!map) return;
  const { lat, lng } = r.location;
  lastLatLng = { lat, lng };
  const band   = safetyBand(r.safetyScore);
  const colors = colorForBand(band.cls);
  mapMarker.setLatLng([lat, lng]);
  mapMarker.bindPopup(`${r.zip} — ${band.label} (Score: ${r.safetyScore})`).openPopup();
  mapCircle.setLatLng([lat, lng]);
  mapCircle.setStyle({ color: colors.stroke, fillColor: colors.fill, fillOpacity: 0.22, weight: 2 });
  map.setView([lat, lng], Math.max(map.getZoom(), 11), { animate: true });
  setTimeout(() => safeInvalidateMap(), 60);
}

function centerMap() {
  initLeafletMap();
  if (!map) return;
  const c = lastLatLng || DEFAULT_CENTER;
  map.setView([c.lat, c.lng], Math.max(map.getZoom(), 11), { animate: true });
  setTimeout(() => safeInvalidateMap(), 60);
}

// ── Fullscreen / Focus ───────────────────────────────
function isMapFullscreen() { return document.fullscreenElement === mapWrapEl; }
function updateFullscreenUI() { fsControlsEl.classList.toggle("hidden", !isMapFullscreen()); }
async function enterFullscreen() { try { await mapWrapEl.requestFullscreen(); } catch(e) {} }
async function exitFullscreen()  { try { if (document.fullscreenElement) await document.exitFullscreen(); } catch(e) {} }
function setFocusMode(on) {
  document.body.classList.toggle("focus-mode", !!on);
  focusExitEl.classList.toggle("hidden", !on);
  setTimeout(() => safeInvalidateMap(), 160);
}
function toggleFocusMode() { setFocusMode(!document.body.classList.contains("focus-mode")); }

// ── Stat cards ───────────────────────────────────────
function updateStatCards(r) {
  if (!r) { statSection.style.display = "none"; return; }
  const band = safetyBand(r.safetyScore);

  statSafety.textContent    = r.safetyScore;
  statSafetySub.textContent = `Safer than ${r.safetyScore}% of U.S.`;
  statViolent.textContent   = r.metrics.violentRate;
  statProperty.textContent  = r.metrics.propertyRate;
  statYear.textContent      = "2023";
  statRisk.textContent      = band.riskLabel;

  // Color risk level dynamically
  statRisk.className = "stat-value";
  if (band.cls === "safe")   statRisk.style.color = "var(--green)";
  if (band.cls === "medium") statRisk.style.color = "var(--yellow)";
  if (band.cls === "risk")   statRisk.style.color = "var(--red)";

  statSection.style.display = "block";
}

// ── Recent cards strip ───────────────────────────────
function renderRecentCards() {
  if (recentData.length === 0) { recentSection.style.display = "none"; return; }
  recentSection.style.display = "flex";
  recentCards.innerHTML = "";

  for (const r of recentData) {
    const band = safetyBand(r.safetyScore);
    const card = document.createElement("div");
    card.className = "recent-card";
    card.innerHTML = `
      <div class="recent-zip">${r.zip} <span class="recent-zip-arrow">›</span></div>
      <div class="recent-score-label">Safety Score</div>
      <div class="recent-score-val">${r.safetyScore}</div>
      <div class="recent-risk ${band.cls}">${band.riskLabel}</div>
      <div class="recent-city">${r.city}, ${r.state}</div>
    `;
    card.addEventListener("click", () => runSearch(r.zip));
    recentCards.appendChild(card);
  }
}

// ── Results render ───────────────────────────────────
function skeletonCard() {
  const d = document.createElement("div");
  d.className = "result-card skeleton";
  d.innerHTML = `
    <div class="result-top">
      <div>
        <div style="height:14px;width:80px;border-radius:6px;background:var(--border);"></div>
        <div style="height:10px;width:140px;margin-top:8px;border-radius:6px;background:var(--bg);"></div>
      </div>
      <div style="height:24px;width:80px;border-radius:999px;background:var(--border);"></div>
    </div>
    <div class="metrics">
      ${[1,2,3].map(()=>`<div class="metric"><div style="height:10px;width:60px;border-radius:6px;background:var(--border);margin-bottom:8px;"></div><div style="height:16px;width:40px;border-radius:6px;background:var(--bg);"></div></div>`).join("")}
    </div>
  `;
  return d;
}

function renderResults() {
  resultsEl.innerHTML = "";
  updateCounts();

  if (results.length === 0) {
    showEmptyState(true);
    emptyState.textContent = compareMode
      ? "Compare Mode is ON. Search at least 2 ZIP codes to compare."
      : "Enter a ZIP code to view results.";
    showCompareSummary(false);
    return;
  }

  showEmptyState(false);

  if (compareMode && results.length >= 2) {
    const avg  = Math.round(results.reduce((a,r) => a + r.safetyScore, 0) / results.length);
    const best = [...results].sort((a,b) => b.safetyScore - a.safetyScore)[0];
    const worst= [...results].sort((a,b) => a.safetyScore - b.safetyScore)[0];
    showCompareSummary(true, `<b>Avg safety:</b> ${avg} — Best: <b>${best.zip}</b> (${best.safetyScore}) — Riskiest: <b>${worst.zip}</b> (${worst.safetyScore})`);
  } else {
    showCompareSummary(false);
  }

  for (const r of results) {
    const band   = safetyBand(r.safetyScore);
    const isOpen = expanded.has(r.zip);
    const card   = document.createElement("div");
    card.className = "result-card";
    card.innerHTML = `
      <div class="result-top">
        <div>
          <div class="result-zip">${r.zip}</div>
          <div class="result-sub">${r.city}, ${r.state} · Confidence ${r.confidence}%</div>
        </div>
        <div class="badge ${band.cls}">${band.label}</div>
      </div>
      <div class="metrics">
        <div class="metric"><div class="k">Safety Score</div><div class="v">${r.safetyScore}</div></div>
        <div class="metric"><div class="k">Violent / 1k</div><div class="v">${r.metrics.violentRate}</div></div>
        <div class="metric"><div class="k">Property / 1k</div><div class="v">${r.metrics.propertyRate}</div></div>
      </div>
      ${isOpen ? `<div class="details"><b>Notes</b><ul>${r.notes.map(n=>`<li>${escapeHtml(n)}</li>`).join("")}</ul></div>` : ""}
      <button class="btn ghost details-toggle" data-zip="${r.zip}" style="margin-top:10px;width:100%;">${isOpen ? "Hide details" : "Show details"}</button>
    `;
    resultsEl.appendChild(card);
  }

  resultsEl.querySelectorAll(".details-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const zip = btn.getAttribute("data-zip");
      expanded.has(zip) ? expanded.delete(zip) : expanded.add(zip);
      renderResults();
    });
  });
}

// ── Sort ─────────────────────────────────────────────
function sortResults() {
  const mode = sortSelect.value;
  if (mode === "safety_desc") results.sort((a,b) => b.safetyScore - a.safetyScore);
  if (mode === "safety_asc")  results.sort((a,b) => a.safetyScore - b.safetyScore);
  if (mode === "zip_asc")     results.sort((a,b) => a.zip.localeCompare(b.zip));
  if (mode === "zip_desc")    results.sort((a,b) => b.zip.localeCompare(a.zip));
  renderResults();
}

// ── Trend chart ───────────────────────────────────────
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
  const w = trendCanvas.width  = trendCanvas.clientWidth  * devicePixelRatio;
  const h = trendCanvas.height = (trendCanvas.clientHeight || 90) * devicePixelRatio;
  trendCtx.clearRect(0,0,w,h);
  trendCtx.lineWidth = 1 * devicePixelRatio;
  trendCtx.strokeStyle = "#e4e7ec";
  for (let i=1;i<=3;i++) {
    const y = (h/4)*i;
    trendCtx.beginPath(); trendCtx.moveTo(0,y); trendCtx.lineTo(w,y); trendCtx.stroke();
  }
  const pad = 18 * devicePixelRatio;
  const xStep = (w - pad*2) / (series.length - 1);
  const toY = v => (h - pad) - ((v/100) * (h - pad*2));
  const pts = series.map((v,i) => ({ x: pad + i*xStep, y: toY(v) }));
  trendCtx.strokeStyle = "#16a34a";
  trendCtx.lineWidth = 2.5 * devicePixelRatio;
  trendCtx.beginPath(); trendCtx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++) trendCtx.lineTo(pts[i].x, pts[i].y);
  trendCtx.stroke();
  trendCtx.fillStyle = "#16a34a";
  for (const p of pts) { trendCtx.beginPath(); trendCtx.arc(p.x,p.y,3.5*devicePixelRatio,0,Math.PI*2); trendCtx.fill(); }
  trendCtx.fillStyle = "#6b7280";
  trendCtx.font = `${11*devicePixelRatio}px -apple-system,sans-serif`;
  trendCtx.textAlign = "center";
  labels.forEach((lab,i) => trendCtx.fillText(lab, pts[i].x, h - 4*devicePixelRatio));
}

// ── Core search ───────────────────────────────────────
async function runSearch(zipRaw) {
  const zip = String(zipRaw || "").trim();
  setInlineError("");
  if (!isValidZip(zip)) { setInlineError("Please enter a valid 5-digit ZIP code."); return; }

  showCompareHint(compareMode);
  showLoading(true);
  resultsEl.innerHTML = "";
  resultsEl.appendChild(skeletonCard());
  resultsEl.appendChild(skeletonCard());

  try {
    const data = await fetchZipData(zip);

    // Update recent strip
    recentData = recentData.filter(r => r.zip !== zip);
    recentData.unshift(data);
    if (recentData.length > 8) recentData = recentData.slice(0, 8);
    renderRecentCards();

    if (!savedZips.includes(zip)) savedZips.push(zip);
    historyZips.push(zip);

    if (compareMode) {
      const already = results.some(r => r.zip === zip);
      if (!already) results.push(data);
      else results = results.map(r => r.zip === zip ? data : r);
    } else {
      results = [data];
      expanded.clear();
    }

    // Show stat cards for the most recent result
    updateStatCards(results[results.length - 1]);

    sortResults();
    renderTrend();
    updateMapForResult(data);

  } catch(err) {
    console.error(err);
    results = [];
    renderResults();
    renderTrend();
    setInlineError("Could not fetch data. Try again (or keep Mock Mode on).");
    updateStatCards(null);
  } finally {
    showLoading(false);
  }
}

// ── Clear actions ─────────────────────────────────────
function clearAll() {
  historyZips = []; savedZips = []; results = []; expanded.clear();
  recentData = [];
  renderRecentCards();
  renderResults();
  renderTrend();
  setInlineError("");
  updateStatCards(null);
  emptyState.textContent = "Enter a ZIP code to view results.";
  showEmptyState(true);
}

// ── Wiring ────────────────────────────────────────────
searchBtn.addEventListener("click", () => runSearch(zipInput.value));
zipInput.addEventListener("keydown", e => { if (e.key === "Enter") runSearch(zipInput.value); });

mockToggle.addEventListener("change", () => { useMockData = mockToggle.checked; });

// Sync both compare mode checkboxes
function setCompareMode(val) {
  compareMode = val;
  compareToggle.checked     = val;
  compareModeCheck.checked  = val;
  showCompareHint(val);
  if (!val && results.length > 1) {
    results = [results[results.length - 1]];
    expanded.clear();
    updateStatCards(results[0]);
  }
  renderResults();
  renderTrend();
  if (results.length === 1) updateMapForResult(results[0]);
}

compareToggle.addEventListener("change",    () => setCompareMode(compareToggle.checked));
compareModeCheck.addEventListener("change", () => setCompareMode(compareModeCheck.checked));

sortSelect.addEventListener("change", () => { sortResults(); renderTrend(); });

clearHistoryBtn.addEventListener("click", () => {
  historyZips = [];
  setInlineError("History cleared.");
  setTimeout(() => setInlineError(""), 1500);
});

clearAllBtn?.addEventListener("click", clearAll);

legendBtn.addEventListener("click", () => legendEl.classList.toggle("hidden"));
centerBtn.addEventListener("click", centerMap);
fullscreenBtn.addEventListener("click", enterFullscreen);
focusBtnMap.addEventListener("click", toggleFocusMode);
exitFocusBtn.addEventListener("click", () => setFocusMode(false));
fsLegendBtn.addEventListener("click", () => legendEl.classList.toggle("hidden"));
fsCenterBtn.addEventListener("click", centerMap);
fsExitBtn.addEventListener("click", exitFullscreen);
fsExitFocusBtn.addEventListener("click", () => setFocusMode(false));

// ── Init ──────────────────────────────────────────────
(function init() {
  useMockData  = mockToggle.checked;
  compareMode  = compareToggle.checked;
  renderResults();
  renderTrend();

  window.addEventListener("load", () => {
    setTopbarHeightVar();
    initLeafletMap();
    updateFullscreenUI();
  });
  window.addEventListener("resize", setTopbarHeightVar);
})();