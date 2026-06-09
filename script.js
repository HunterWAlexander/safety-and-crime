// ---------------------------
// Safety & Crime — script.js
// Calls /functions/zip for real FBI + Census data
// ---------------------------

const zipInput    = document.getElementById("zipInput");
const zipError    = document.getElementById("zipError");
const searchBtn   = document.getElementById("searchBtn");
const resultsEl   = document.getElementById("results");

// Stat card elements — matched to index.html IDs
const elSafety    = document.getElementById("statSafety");
const elSafetySub = document.getElementById("statSafetySub");
const elViolent   = document.getElementById("statViolent");
const elProperty  = document.getElementById("statProperty");
const elYear      = document.getElementById("statYear");
const elRisk      = document.getElementById("statRisk");
const statSection = document.getElementById("statSection");

// Recent ZIPs
const recentSection = document.getElementById("recentSection");
const recentCards   = document.getElementById("recentCards");

// Status elements
const emptyState   = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const resultsCount = document.getElementById("resultsCount");

// ── MAP SETUP ──────────────────────────────────────────────────────────
// Wait for Leaflet to load (it's deferred)
let map, currentMarker;

window.addEventListener("load", () => {
  map = L.map("map").setView([39.5, -98.35], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);
});

function placeMarker(lat, lng, label, riskLevel) {
  if (!map) return;
  if (currentMarker) map.removeLayer(currentMarker);

  const color =
    riskLevel === "Low Risk"    ? "#16a34a" :
    riskLevel === "Medium Risk" ? "#d97706" : "#dc2626";

  const icon = L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      width:16px;height:16px;
      border-radius:50%;
      border:2px solid white;
      box-shadow:0 0 6px rgba(0,0,0,.4)
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  currentMarker = L.marker([lat, lng], { icon })
    .addTo(map)
    .bindPopup(`<strong>${label}</strong><br>${riskLevel}`)
    .openPopup();
  map.setView([lat, lng], 11);
}

// ── RECENT ZIPS ────────────────────────────────────────────────────────
let recentZips = JSON.parse(localStorage.getItem("recentZips") || "[]");

function saveRecent(data) {
  recentZips = recentZips.filter((z) => z.zip !== data.zip);
  recentZips.unshift(data);
  if (recentZips.length > 6) recentZips.pop();
  localStorage.setItem("recentZips", JSON.stringify(recentZips));
  renderRecent();
}

function renderRecent() {
  if (!recentSection || !recentCards) return;
  if (recentZips.length === 0) {
    recentSection.style.display = "none";
    return;
  }
  recentSection.style.display = "block";
  recentCards.innerHTML = recentZips
    .map((z) => {
      const cls =
        z.riskLevel === "Low Risk"    ? "low" :
        z.riskLevel === "Medium Risk" ? "medium" : "high";
      return `
        <div class="recent-card ${cls}" onclick="searchZip('${z.zip}')" style="cursor:pointer;">
          <div class="recent-zip">${z.zip}</div>
          <div class="recent-city">${z.city}, ${z.state}</div>
          <div class="recent-score">Score ${z.safetyScore ?? "N/A"}</div>
          <div class="recent-risk">${z.riskLevel}</div>
        </div>`;
    })
    .join("");
}

renderRecent();

// ── FETCH FROM CLOUDFLARE FUNCTION ────────────────────────────────────
async function fetchZipData(zip) {
  const res = await fetch(`/functions/zip?zip=${zip}`);
  if (!res.ok) throw new Error("Lookup failed");
  return res.json();
}

// ── MOCK FALLBACK ──────────────────────────────────────────────────────
function mockData(zip) {
  const seed = zip.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const safetyScore = 20 + (seed % 61);
  const riskLevel =
    safetyScore >= 70 ? "Low Risk" :
    safetyScore >= 40 ? "Medium Risk" : "High Risk";
  return {
    zip,
    city: "Sample City",
    state: "TX",
    lat: 29.76 + (seed % 10) * 0.05,
    lng: -95.37 + (seed % 10) * 0.05,
    violentCrime: 200 + (seed % 600),
    propertyCrime: 1000 + (seed % 3000),
    dataYear: 2022,
    safetyScore,
    riskLevel,
    hasRealData: false,
  };
}

// ── RENDER RESULTS ─────────────────────────────────────────────────────
function renderResults(data) {
  const { zip, city, state, lat, lng, violentCrime, propertyCrime,
          dataYear, safetyScore, riskLevel, hasRealData } = data;

  // Hide empty state, show stat cards
  if (emptyState)   emptyState.style.display   = "none";
  if (loadingState) loadingState.style.display  = "none";
  if (statSection)  statSection.style.display   = "block";

  // Safety score
  if (elSafety)    elSafety.textContent    = safetyScore ?? "N/A";
  if (elSafetySub) elSafetySub.textContent = safetyScore
    ? `Safer than ${safetyScore}% of U.S.`
    : "Score unavailable";

  // Crime counts
  if (elViolent)  elViolent.textContent  = violentCrime  != null ? violentCrime.toLocaleString()  : "N/A";
  if (elProperty) elProperty.textContent = propertyCrime != null ? propertyCrime.toLocaleString() : "N/A";
  if (elYear)     elYear.textContent     = dataYear ?? "N/A";
  if (elRisk)     elRisk.textContent     = riskLevel;

  // Results count
  if (resultsCount) resultsCount.textContent = "1";

  // Data source footer note
  const footer = document.querySelector(".footer");
  if (footer) {
    footer.innerHTML = hasRealData
      ? `Data Sources: <b>FBI UCR (Real Data)</b> · ${dataYear}`
      : `Data Sources: <b>Estimated</b> — FBI data unavailable for this area`;
    footer.style.color = hasRealData ? "#16a34a" : "#d97706";
  }

  // Map marker
  if (lat && lng) placeMarker(lat, lng, `${zip} — ${riskLevel}`, riskLevel);

  // Save to recent
  saveRecent({ zip, city, state, safetyScore, riskLevel });
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchZip(zip) {
  zip = zip || zipInput.value.trim();
  if (!/^\d{5}$/.test(zip)) {
    if (zipError) {
      zipError.textContent = "Please enter a valid 5-digit ZIP code.";
      zipError.classList.remove("hidden");
    }
    return;
  }
  if (zipError) {
    zipError.textContent = "";
    zipError.classList.add("hidden");
  }

  // Show loading
  if (emptyState)   emptyState.style.display   = "none";
  if (loadingState) {
    loadingState.style.display = "block";
    loadingState.classList.remove("hidden");
  }
  if (statSection) statSection.style.display = "none";

  let data;
  try {
    data = await fetchZipData(zip);
    if (!data.hasRealData) {
      const mock = mockData(zip);
      data = { ...mock, ...data, hasRealData: false };
    }
  } catch (err) {
    console.warn("Function error, using mock data:", err);
    data = mockData(zip);
  }

  renderResults(data);
}

// ── EVENT LISTENERS ────────────────────────────────────────────────────
if (searchBtn) {
  searchBtn.addEventListener("click", () => searchZip());
}

if (zipInput) {
  zipInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchZip();
  });
}

// ── CLEAR HISTORY ──────────────────────────────────────────────────────
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearAllBtn     = document.getElementById("clearAllBtn");

function clearHistory() {
  recentZips = [];
  localStorage.removeItem("recentZips");
  renderRecent();
}

if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", clearHistory);
if (clearAllBtn)     clearAllBtn.addEventListener("click", clearHistory);

// ── FULLSCREEN / FOCUS ─────────────────────────────────────────────────
const fullscreenBtn  = document.getElementById("fullscreenBtn");
const centerBtn      = document.getElementById("centerBtn");
const focusBtnMap    = document.getElementById("focusBtnMap");
const fsExitBtn      = document.getElementById("fsExitBtn");
const fsCenterBtn    = document.getElementById("fsCenterBtn");
const fsControls     = document.getElementById("fsControls");
const exitFocusBtn   = document.getElementById("exitFocusBtn");
const focusExit      = document.getElementById("focusExit");
const mapCard        = document.getElementById("mapCard");

if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", () => {
    mapCard?.classList.toggle("fullscreen");
    if (fsControls) fsControls.classList.toggle("hidden");
    setTimeout(() => map?.invalidateSize(), 300);
  });
}

if (fsExitBtn) {
  fsExitBtn.addEventListener("click", () => {
    mapCard?.classList.remove("fullscreen");
    if (fsControls) fsControls.classList.add("hidden");
    setTimeout(() => map?.invalidateSize(), 300);
  });
}

if (centerBtn || fsCenterBtn) {
  const doCenter = () => map?.setView([39.5, -98.35], 4);
  centerBtn?.addEventListener("click", doCenter);
  fsCenterBtn?.addEventListener("click", doCenter);
}

if (focusBtnMap) {
  focusBtnMap.addEventListener("click", () => {
    document.body.classList.toggle("focus-mode");
    if (focusExit) focusExit.classList.toggle("hidden");
    setTimeout(() => map?.invalidateSize(), 300);
  });
}

if (exitFocusBtn) {
  exitFocusBtn.addEventListener("click", () => {
    document.body.classList.remove("focus-mode");
    if (focusExit) focusExit.classList.add("hidden");
    setTimeout(() => map?.invalidateSize(), 300);
  });
}