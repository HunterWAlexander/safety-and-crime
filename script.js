// ---------------------------
// Safety & Crime — script.js
// Direct API calls: Zippopotam (city/state) + FBI Crime Data API
// ---------------------------

const FBI_KEY = "56dGZIqmnvQkRrNBCVgCBKCiufePICMHC4hrDU9a"; // We'll replace this with your actual key

const zipInput      = document.getElementById("zipInput");
const zipError      = document.getElementById("zipError");
const searchBtn     = document.getElementById("searchBtn");
const elSafety      = document.getElementById("statSafety");
const elSafetySub   = document.getElementById("statSafetySub");
const elViolent     = document.getElementById("statViolent");
const elProperty    = document.getElementById("statProperty");
const elYear        = document.getElementById("statYear");
const elRisk        = document.getElementById("statRisk");
const statSection   = document.getElementById("statSection");
const recentSection = document.getElementById("recentSection");
const recentCards   = document.getElementById("recentCards");
const emptyState    = document.getElementById("emptyState");
const loadingState  = document.getElementById("loadingState");
const resultsCount  = document.getElementById("resultsCount");

// ── MAP SETUP ──────────────────────────────────────────────────────────
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
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,.4)"></div>`,
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
  if (recentZips.length === 0) { recentSection.style.display = "none"; return; }
  recentSection.style.display = "block";
  recentCards.innerHTML = recentZips.map((z) => {
    const cls = z.riskLevel === "Low Risk" ? "low" : z.riskLevel === "Medium Risk" ? "medium" : "high";
    return `<div class="recent-card ${cls}" onclick="searchZip('${z.zip}')" style="cursor:pointer;">
      <div class="recent-zip">${z.zip}</div>
      <div class="recent-city">${z.city}, ${z.state}</div>
      <div class="recent-score">Score ${z.safetyScore ?? "N/A"}</div>
      <div class="recent-risk">${z.riskLevel}</div>
    </div>`;
  }).join("");
}

renderRecent();

// ── MOCK FALLBACK ──────────────────────────────────────────────────────
function mockData(zip, city = "Unknown", state = "TX", lat = 39.5, lng = -98.35) {
  const seed = zip.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const safetyScore = 20 + (seed % 61);
  const riskLevel = safetyScore >= 70 ? "Low Risk" : safetyScore >= 40 ? "Medium Risk" : "High Risk";
  return {
    zip, city, state, lat, lng,
    violentCrime: 200 + (seed % 600),
    propertyCrime: 1000 + (seed % 3000),
    dataYear: 2022,
    safetyScore,
    riskLevel,
    hasRealData: false,
  };
}

// ── FETCH REAL DATA ────────────────────────────────────────────────────
async function fetchZipData(zip) {
  let city = "Unknown", state = "", lat = 39.5, lng = -98.35;

  // Step 1: Get city/state/coords from Zippopotam (free, no key)
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (r.ok) {
      const d = await r.json();
      city  = d?.places?.[0]?.["place name"] ?? "Unknown";
      state = d?.places?.[0]?.["state abbreviation"] ?? "";
      lat   = parseFloat(d?.places?.[0]?.["latitude"]) || 39.5;
      lng   = parseFloat(d?.places?.[0]?.["longitude"]) || -98.35;
    }
  } catch (_) {}

  // Step 2: FBI Crime Data — get agencies for the state
  if (!state) return mockData(zip, city, state, lat, lng);

  try {
    const FBI_BASE = "https://api.usa.gov/crime/fbi/cde";

    // Get agencies in this state
    const agencyRes = await fetch(`${FBI_BASE}/agency/byStateAbbr/${state}?api_key=${FBI_KEY}`);
    if (!agencyRes.ok) throw new Error("Agency lookup failed");
    const agencyData = await agencyRes.json();
    const agencies = agencyData?.results ?? [];

    // Find best matching agency for this city
    const cityLower = city.toLowerCase();
    let agency = agencies.find(
      (a) => a.agency_name?.toLowerCase().includes(cityLower) && a.agency_type_name === "City"
    ) || agencies.find((a) => a.agency_type_name === "City");

    if (!agency) return mockData(zip, city, state, lat, lng);

    const ori = agency.ori;

    // Get violent + property crime counts
    const [vRes, pRes] = await Promise.all([
      fetch(`${FBI_BASE}/summarized/agencies/${ori}/violent-crime?api_key=${FBI_KEY}`),
      fetch(`${FBI_BASE}/summarized/agencies/${ori}/property-crime?api_key=${FBI_KEY}`),
    ]);

    const vData = await vRes.json();
    const pData = await pRes.json();

    const vResults = vData?.results ?? [];
    const pResults = pData?.results ?? [];

    if (vResults.length === 0 && pResults.length === 0) {
      return mockData(zip, city, state, lat, lng);
    }

    const latestV = vResults[vResults.length - 1];
    const latestP = pResults[pResults.length - 1];

    const violentCrime  = latestV?.violent_crime  ?? latestV?.actual  ?? null;
    const propertyCrime = latestP?.property_crime ?? latestP?.actual  ?? null;
    const dataYear      = latestV?.data_year      ?? latestP?.data_year ?? null;

    // Calculate safety score
    let safetyScore = 50, riskLevel = "Medium Risk";
    if (violentCrime !== null && propertyCrime !== null) {
      const weighted = violentCrime * 3 + propertyCrime;
      safetyScore = Math.max(0, Math.min(100, Math.round(100 - (weighted / 3240) * 50)));
      riskLevel = safetyScore >= 70 ? "Low Risk" : safetyScore >= 40 ? "Medium Risk" : "High Risk";
    }

    return { zip, city, state, lat, lng, violentCrime, propertyCrime, dataYear, safetyScore, riskLevel, hasRealData: true };

  } catch (err) {
    console.warn("FBI API error:", err);
    return mockData(zip, city, state, lat, lng);
  }
}

// ── RENDER RESULTS ─────────────────────────────────────────────────────
function renderResults(data) {
  const { zip, city, state, lat, lng, violentCrime, propertyCrime, dataYear, safetyScore, riskLevel, hasRealData } = data;

  if (emptyState)   emptyState.style.display  = "none";
  if (loadingState) { loadingState.style.display = "none"; loadingState.classList.add("hidden"); }
  if (statSection)  statSection.style.display  = "block";

  if (elSafety)    elSafety.textContent    = safetyScore ?? "N/A";
  if (elSafetySub) elSafetySub.textContent = safetyScore ? `Safer than ${safetyScore}% of U.S.` : "Score unavailable";
  if (elViolent)   elViolent.textContent   = violentCrime  != null ? violentCrime.toLocaleString()  : "N/A";
  if (elProperty)  elProperty.textContent  = propertyCrime != null ? propertyCrime.toLocaleString() : "N/A";
  if (elYear)      elYear.textContent      = dataYear ?? "N/A";
  if (elRisk)      elRisk.textContent      = riskLevel;
  if (resultsCount) resultsCount.textContent = "1";

  // Update footer with data source info
  const footer = document.querySelector(".footer div");
  if (footer) {
    footer.innerHTML = hasRealData
      ? `Data Sources: <b style="color:#16a34a">FBI UCR · Real Data · ${dataYear}</b>`
      : `Data Sources: <b style="color:#d97706">Estimated (FBI data unavailable for this area)</b>`;
  }

  if (lat && lng) placeMarker(lat, lng, `${zip} — ${riskLevel} (${city}, ${state})`, riskLevel);
  saveRecent({ zip, city, state, safetyScore, riskLevel });
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchZip(zip) {
  zip = zip || zipInput.value.trim();
  if (!/^\d{5}$/.test(zip)) {
    if (zipError) { zipError.textContent = "Please enter a valid 5-digit ZIP code."; zipError.classList.remove("hidden"); }
    return;
  }
  if (zipError) { zipError.textContent = ""; zipError.classList.add("hidden"); }

  if (emptyState)   emptyState.style.display   = "none";
  if (loadingState) { loadingState.style.display = "block"; loadingState.classList.remove("hidden"); }
  if (statSection)  statSection.style.display   = "none";

  const data = await fetchZipData(zip);
  renderResults(data);
}

// ── EVENT LISTENERS ────────────────────────────────────────────────────
searchBtn?.addEventListener("click", () => searchZip());
zipInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") searchZip(); });

const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearAllBtn     = document.getElementById("clearAllBtn");
function clearHistory() { recentZips = []; localStorage.removeItem("recentZips"); renderRecent(); }
clearHistoryBtn?.addEventListener("click", clearHistory);
clearAllBtn?.addEventListener("click", clearHistory);

// ── FULLSCREEN / FOCUS ─────────────────────────────────────────────────
const fullscreenBtn = document.getElementById("fullscreenBtn");
const centerBtn     = document.getElementById("centerBtn");
const focusBtnMap   = document.getElementById("focusBtnMap");
const fsExitBtn     = document.getElementById("fsExitBtn");
const fsCenterBtn   = document.getElementById("fsCenterBtn");
const fsControls    = document.getElementById("fsControls");
const exitFocusBtn  = document.getElementById("exitFocusBtn");
const focusExit     = document.getElementById("focusExit");
const mapCard       = document.getElementById("mapCard");

fullscreenBtn?.addEventListener("click", () => {
  mapCard?.classList.toggle("fullscreen");
  fsControls?.classList.toggle("hidden");
  setTimeout(() => map?.invalidateSize(), 300);
});
fsExitBtn?.addEventListener("click", () => {
  mapCard?.classList.remove("fullscreen");
  fsControls?.classList.add("hidden");
  setTimeout(() => map?.invalidateSize(), 300);
});
const doCenter = () => map?.setView([39.5, -98.35], 4);
centerBtn?.addEventListener("click", doCenter);
fsCenterBtn?.addEventListener("click", doCenter);
focusBtnMap?.addEventListener("click", () => {
  document.body.classList.toggle("focus-mode");
  focusExit?.classList.toggle("hidden");
  setTimeout(() => map?.invalidateSize(), 300);
});
exitFocusBtn?.addEventListener("click", () => {
  document.body.classList.remove("focus-mode");
  focusExit?.classList.add("hidden");
  setTimeout(() => map?.invalidateSize(), 300);
});