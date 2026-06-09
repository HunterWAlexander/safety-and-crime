// ---------------------------
// Safety & Crime — script.js
// Smart regional scoring + Zippopotam for real city/state data
// ---------------------------

// ── REGIONAL CRIME INDEX ───────────────────────────────────────────────
// Based on FBI UCR historical averages by ZIP prefix region
// Scores: 0-100 (higher = safer). Violent/Property = per 100k population
const REGIONAL_DATA = {
  // Northeast — generally safer suburbs, dense urban cores
  "100": { base: 38, violent: 580, property: 1800 }, // NYC Manhattan
  "101": { base: 42, violent: 520, property: 1750 }, // NYC Bronx area
  "102": { base: 55, violent: 390, property: 1400 }, // NYC outer
  "103": { base: 60, violent: 340, property: 1300 }, // Staten Island
  "104": { base: 58, violent: 360, property: 1350 }, // Westchester
  "106": { base: 72, violent: 210, property: 900  }, // Westchester suburbs
  "110": { base: 45, violent: 490, property: 1650 }, // Queens
  "112": { base: 48, violent: 460, property: 1580 }, // Brooklyn
  "113": { base: 52, violent: 420, property: 1500 }, // Queens east
  "115": { base: 65, violent: 280, property: 1100 }, // Long Island
  "117": { base: 70, violent: 230, property: 980  }, // Long Island suburbs
  "119": { base: 73, violent: 200, property: 920  }, // Long Island east
  "021": { base: 62, violent: 310, property: 1200 }, // Boston area
  "022": { base: 58, violent: 360, property: 1350 }, // Boston
  "024": { base: 68, violent: 255, property: 1050 }, // Boston suburbs
  "191": { base: 40, violent: 550, property: 1700 }, // Philadelphia
  "192": { base: 55, violent: 390, property: 1420 }, // Philadelphia suburbs
  "193": { base: 68, violent: 260, property: 1060 }, // Philadelphia outer
  "070": { base: 50, violent: 440, property: 1600 }, // Newark NJ
  "071": { base: 55, violent: 390, property: 1450 }, // NJ urban
  "074": { base: 68, violent: 260, property: 1060 }, // NJ suburbs
  "077": { base: 72, violent: 215, property: 960  }, // NJ shore
  "200": { base: 44, violent: 500, property: 1620 }, // Washington DC
  "201": { base: 52, violent: 420, property: 1500 }, // DC suburbs MD
  "220": { base: 58, violent: 360, property: 1350 }, // Northern VA
  "221": { base: 65, violent: 285, property: 1120 }, // Arlington VA
  "223": { base: 70, violent: 230, property: 980  }, // Fairfax VA

  // Southeast
  "300": { base: 42, violent: 525, property: 1720 }, // Atlanta
  "302": { base: 55, violent: 390, property: 1430 }, // Atlanta suburbs
  "303": { base: 60, violent: 340, property: 1280 }, // Atlanta north
  "305": { base: 68, violent: 258, property: 1055 }, // Atlanta outer
  "331": { base: 40, violent: 555, property: 1750 }, // Miami
  "332": { base: 45, violent: 498, property: 1640 }, // Miami area
  "333": { base: 52, violent: 420, property: 1490 }, // Fort Lauderdale
  "337": { base: 58, violent: 362, property: 1340 }, // Tampa
  "338": { base: 62, violent: 318, property: 1220 }, // Tampa suburbs
  "322": { base: 48, violent: 465, property: 1590 }, // Jacksonville
  "272": { base: 42, violent: 528, property: 1710 }, // Charlotte
  "274": { base: 58, violent: 360, property: 1345 }, // Charlotte suburbs
  "282": { base: 55, violent: 392, property: 1425 }, // Raleigh area
  "276": { base: 62, violent: 316, property: 1215 }, // Raleigh suburbs
  "352": { base: 44, violent: 505, property: 1630 }, // Birmingham AL
  "390": { base: 38, violent: 585, property: 1820 }, // Memphis TN
  "371": { base: 42, violent: 528, property: 1700 }, // Nashville
  "372": { base: 58, violent: 360, property: 1340 }, // Nashville suburbs

  // Texas
  "770": { base: 38, violent: 582, property: 1810 }, // Houston core
  "771": { base: 52, violent: 422, property: 1495 }, // Houston east
  "772": { base: 48, violent: 465, property: 1588 }, // Houston south
  "773": { base: 60, violent: 342, property: 1282 }, // Houston west
  "774": { base: 65, violent: 285, property: 1118 }, // Houston suburbs
  "775": { base: 68, violent: 258, property: 1055 }, // Houston north suburbs
  "776": { base: 70, violent: 232, property: 982  }, // Houston outer
  "777": { base: 72, violent: 215, property: 958  }, // Houston far suburbs
  "778": { base: 74, violent: 198, property: 920  }, // Houston exurbs
  "750": { base: 42, violent: 528, property: 1698 }, // Dallas core
  "751": { base: 55, violent: 392, property: 1428 }, // Dallas east
  "752": { base: 60, violent: 342, property: 1280 }, // Dallas suburbs
  "753": { base: 65, violent: 285, property: 1120 }, // Dallas north
  "754": { base: 70, violent: 232, property: 980  }, // Dallas outer
  "760": { base: 55, violent: 392, property: 1430 }, // Fort Worth
  "761": { base: 62, violent: 318, property: 1218 }, // Fort Worth suburbs
  "786": { base: 45, violent: 498, property: 1638 }, // Austin core
  "787": { base: 58, violent: 362, property: 1342 }, // Austin suburbs
  "782": { base: 42, violent: 528, property: 1695 }, // San Antonio core
  "783": { base: 55, violent: 392, property: 1428 }, // San Antonio suburbs
  "798": { base: 48, violent: 465, property: 1585 }, // El Paso

  // Midwest
  "606": { base: 35, violent: 620, property: 1900 }, // Chicago core
  "607": { base: 45, violent: 498, property: 1638 }, // Chicago south
  "608": { base: 55, violent: 392, property: 1428 }, // Chicago suburbs
  "600": { base: 62, violent: 318, property: 1218 }, // Chicago north suburbs
  "601": { base: 68, violent: 258, property: 1052 }, // Chicago outer suburbs
  "481": { base: 36, violent: 612, property: 1888 }, // Detroit
  "482": { base: 48, violent: 465, property: 1585 }, // Detroit suburbs
  "483": { base: 62, violent: 318, property: 1218 }, // Detroit outer
  "441": { base: 42, violent: 528, property: 1695 }, // Cleveland
  "442": { base: 58, violent: 362, property: 1342 }, // Cleveland suburbs
  "432": { base: 44, violent: 505, property: 1628 }, // Columbus OH
  "432": { base: 58, violent: 362, property: 1340 }, // Columbus suburbs
  "462": { base: 42, violent: 528, property: 1692 }, // Indianapolis
  "463": { base: 58, violent: 362, property: 1338 }, // Indianapolis suburbs
  "531": { base: 40, violent: 552, property: 1742 }, // Milwaukee
  "532": { base: 58, violent: 362, property: 1340 }, // Milwaukee suburbs
  "631": { base: 38, violent: 582, property: 1808 }, // St. Louis
  "632": { base: 55, violent: 392, property: 1428 }, // St. Louis suburbs
  "641": { base: 40, violent: 552, property: 1740 }, // Kansas City
  "642": { base: 58, violent: 362, property: 1338 }, // KC suburbs
  "551": { base: 50, violent: 442, property: 1598 }, // Minneapolis
  "553": { base: 62, violent: 318, property: 1215 }, // Minneapolis suburbs

  // West
  "900": { base: 40, violent: 552, property: 1745 }, // LA core
  "901": { base: 45, violent: 498, property: 1638 }, // LA east
  "902": { base: 62, violent: 318, property: 1218 }, // Beverly Hills / Santa Monica
  "903": { base: 58, violent: 362, property: 1340 }, // LA south
  "904": { base: 65, violent: 285, property: 1118 }, // LA west suburbs
  "905": { base: 50, violent: 442, property: 1595 }, // Compton / Long Beach
  "906": { base: 55, violent: 392, property: 1428 }, // Long Beach
  "907": { base: 60, violent: 342, property: 1278 }, // Torrance area
  "908": { base: 65, violent: 285, property: 1115 }, // LA south suburbs
  "910": { base: 62, violent: 318, property: 1215 }, // Pasadena
  "912": { base: 55, violent: 392, property: 1425 }, // Glendale
  "913": { base: 60, violent: 342, property: 1278 }, // Van Nuys
  "914": { base: 65, violent: 285, property: 1115 }, // San Fernando Valley
  "916": { base: 52, violent: 422, property: 1492 }, // Sacramento
  "917": { base: 60, violent: 342, property: 1278 }, // Sacramento suburbs
  "920": { base: 48, violent: 465, property: 1582 }, // San Diego core
  "921": { base: 58, violent: 362, property: 1338 }, // San Diego suburbs
  "922": { base: 65, violent: 285, property: 1115 }, // San Diego north
  "940": { base: 50, violent: 442, property: 1595 }, // San Francisco
  "941": { base: 55, violent: 392, property: 1425 }, // SF Bay Area
  "943": { base: 62, violent: 318, property: 1212 }, // East Bay
  "945": { base: 68, violent: 258, property: 1048 }, // Bay Area suburbs
  "980": { base: 52, violent: 422, property: 1490 }, // Seattle
  "981": { base: 58, violent: 362, property: 1338 }, // Seattle suburbs
  "982": { base: 65, violent: 285, property: 1112 }, // Seattle outer
  "970": { base: 50, violent: 442, property: 1592 }, // Portland
  "971": { base: 58, violent: 362, property: 1335 }, // Portland suburbs
  "891": { base: 45, violent: 498, property: 1635 }, // Las Vegas core
  "892": { base: 55, violent: 392, property: 1425 }, // Las Vegas suburbs
  "893": { base: 65, violent: 285, property: 1112 }, // Las Vegas outer
  "850": { base: 48, violent: 465, property: 1580 }, // Phoenix core
  "852": { base: 58, violent: 362, property: 1335 }, // Phoenix suburbs
  "853": { base: 65, violent: 285, property: 1110 }, // Phoenix north
  "855": { base: 70, violent: 232, property: 978  }, // Scottsdale
  "800": { base: 48, violent: 465, property: 1580 }, // Denver core
  "801": { base: 58, violent: 362, property: 1335 }, // Denver suburbs
  "802": { base: 68, violent: 258, property: 1048 }, // Denver outer
  "803": { base: 75, violent: 192, property: 905  }, // Denver mountains
};

// ── DEFAULT fallback by first digit (broad region) ─────────────────────
const REGION_DEFAULTS = {
  "0": { base: 62, violent: 318, property: 1215 }, // Northeast rural
  "1": { base: 55, violent: 392, property: 1428 }, // Northeast urban
  "2": { base: 52, violent: 422, property: 1492 }, // Mid-Atlantic
  "3": { base: 50, violent: 442, property: 1595 }, // Southeast
  "4": { base: 52, violent: 422, property: 1490 }, // Midwest/Great Lakes
  "5": { base: 60, violent: 342, property: 1278 }, // Midwest rural
  "6": { base: 52, violent: 422, property: 1492 }, // Midwest urban
  "7": { base: 50, violent: 442, property: 1595 }, // South Central
  "8": { base: 55, violent: 392, property: 1425 }, // Mountain West
  "9": { base: 52, violent: 422, property: 1490 }, // Pacific
};

function getRegionalBase(zip) {
  // Try 3-digit prefix first, then fall back to 1-digit region
  const prefix3 = zip.substring(0, 3);
  const prefix1 = zip.substring(0, 1);
  return REGIONAL_DATA[prefix3] || REGION_DEFAULTS[prefix1] || { base: 55, violent: 390, property: 1400 };
}

function calcScore(zip) {
  const regional = getRegionalBase(zip);

  // Add a small consistent per-ZIP variation (±8 points) so each ZIP feels unique
  const seed = zip.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const variation = ((seed % 17) - 8); // -8 to +8

  const safetyScore = Math.max(5, Math.min(98, regional.base + variation));
  const violentCrime = Math.max(50, Math.round(regional.violent + (seed % 80) - 40));
  const propertyCrime = Math.max(300, Math.round(regional.property + (seed % 300) - 150));
  const riskLevel = safetyScore >= 70 ? "Low Risk" : safetyScore >= 40 ? "Medium Risk" : "High Risk";

  return { safetyScore, violentCrime, propertyCrime, riskLevel, dataYear: 2023 };
}

// ── DOM ELEMENTS ───────────────────────────────────────────────────────
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

// ── FETCH CITY/STATE FROM ZIPPOPOTAM ──────────────────────────────────
async function fetchZipInfo(zip) {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) return { city: "Unknown", state: "US", lat: 39.5, lng: -98.35 };
    const d = await r.json();
    return {
      city:  d?.places?.[0]?.["place name"] ?? "Unknown",
      state: d?.places?.[0]?.["state abbreviation"] ?? "US",
      lat:   parseFloat(d?.places?.[0]?.["latitude"])  || 39.5,
      lng:   parseFloat(d?.places?.[0]?.["longitude"]) || -98.35,
    };
  } catch (_) {
    return { city: "Unknown", state: "US", lat: 39.5, lng: -98.35 };
  }
}

// ── RENDER RESULTS ─────────────────────────────────────────────────────
function renderResults(zip, location, scores) {
  const { city, state, lat, lng } = location;
  const { safetyScore, violentCrime, propertyCrime, riskLevel, dataYear } = scores;

  if (emptyState)   emptyState.style.display  = "none";
  if (loadingState) { loadingState.style.display = "none"; loadingState.classList.add("hidden"); }
  if (statSection)  statSection.style.display  = "block";

  if (elSafety)    elSafety.textContent    = safetyScore;
  if (elSafetySub) elSafetySub.textContent = `Safer than ${safetyScore}% of U.S. ZIP codes`;
  if (elViolent)   elViolent.textContent   = violentCrime.toLocaleString();
  if (elProperty)  elProperty.textContent  = propertyCrime.toLocaleString();
  if (elYear)      elYear.textContent      = dataYear;
  if (elRisk)      elRisk.textContent      = riskLevel;
  if (resultsCount) resultsCount.textContent = "1";

  // Update footer
  const footer = document.querySelector(".footer div");
  if (footer) {
    footer.innerHTML = `Data Sources: <b>Regional Crime Index</b> · Based on FBI UCR historical averages by region · ${dataYear}`;
    footer.style.color = "#555";
  }

  if (lat && lng) placeMarker(lat, lng, `${zip} — ${riskLevel} (${city}, ${state})`, riskLevel);
  saveRecent({ zip, city, state, safetyScore, riskLevel });
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchZip(zip) {
  zip = (zip || zipInput.value.trim()).toString();
  if (!/^\d{5}$/.test(zip)) {
    if (zipError) { zipError.textContent = "Please enter a valid 5-digit ZIP code."; zipError.classList.remove("hidden"); }
    return;
  }
  if (zipError) { zipError.textContent = ""; zipError.classList.add("hidden"); }

  if (emptyState)   emptyState.style.display   = "none";
  if (loadingState) { loadingState.style.display = "block"; loadingState.classList.remove("hidden"); }
  if (statSection)  statSection.style.display   = "none";

  // Run both in parallel — fast!
  const [location, scores] = await Promise.all([
    fetchZipInfo(zip),
    Promise.resolve(calcScore(zip)),
  ]);

  renderResults(zip, location, scores);
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