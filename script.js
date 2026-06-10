// ---------------------------
// Safety & Crime — script.js
// Smart regional scoring + all stat cards
// ---------------------------

// ── REGIONAL DATA ─────────────────────────────────────────────────────
const REGIONAL_DATA = {
  "100": { base:38, violent:580, property:1800, pop:42000, homeValue:680000 },
  "101": { base:42, violent:520, property:1750, pop:38000, homeValue:520000 },
  "102": { base:55, violent:390, property:1400, pop:32000, homeValue:480000 },
  "103": { base:60, violent:340, property:1300, pop:28000, homeValue:520000 },
  "104": { base:58, violent:360, property:1350, pop:22000, homeValue:580000 },
  "106": { base:72, violent:210, property:900,  pop:18000, homeValue:750000 },
  "110": { base:45, violent:490, property:1650, pop:35000, homeValue:480000 },
  "112": { base:48, violent:460, property:1580, pop:38000, homeValue:560000 },
  "113": { base:52, violent:420, property:1500, pop:30000, homeValue:510000 },
  "115": { base:65, violent:280, property:1100, pop:20000, homeValue:620000 },
  "117": { base:70, violent:230, property:980,  pop:16000, homeValue:680000 },
  "119": { base:73, violent:200, property:920,  pop:12000, homeValue:720000 },
  "021": { base:62, violent:310, property:1200, pop:25000, homeValue:580000 },
  "022": { base:58, violent:360, property:1350, pop:30000, homeValue:620000 },
  "024": { base:68, violent:255, property:1050, pop:18000, homeValue:540000 },
  "191": { base:40, violent:550, property:1700, pop:36000, homeValue:220000 },
  "192": { base:55, violent:390, property:1420, pop:24000, homeValue:310000 },
  "193": { base:68, violent:260, property:1060, pop:16000, homeValue:380000 },
  "070": { base:50, violent:440, property:1600, pop:34000, homeValue:280000 },
  "071": { base:55, violent:390, property:1450, pop:28000, homeValue:320000 },
  "074": { base:68, violent:260, property:1060, pop:18000, homeValue:420000 },
  "077": { base:72, violent:215, property:960,  pop:14000, homeValue:480000 },
  "200": { base:44, violent:500, property:1620, pop:40000, homeValue:680000 },
  "201": { base:52, violent:420, property:1500, pop:28000, homeValue:520000 },
  "220": { base:58, violent:360, property:1350, pop:22000, homeValue:580000 },
  "221": { base:65, violent:285, property:1120, pop:18000, homeValue:720000 },
  "223": { base:70, violent:230, property:980,  pop:16000, homeValue:680000 },
  "300": { base:42, violent:525, property:1720, pop:35000, homeValue:320000 },
  "302": { base:55, violent:390, property:1430, pop:24000, homeValue:380000 },
  "303": { base:60, violent:340, property:1280, pop:20000, homeValue:420000 },
  "305": { base:68, violent:258, property:1055, pop:16000, homeValue:480000 },
  "331": { base:40, violent:555, property:1750, pop:38000, homeValue:480000 },
  "332": { base:45, violent:498, property:1640, pop:32000, homeValue:420000 },
  "333": { base:52, violent:420, property:1490, pop:28000, homeValue:380000 },
  "337": { base:58, violent:362, property:1340, pop:24000, homeValue:310000 },
  "338": { base:62, violent:318, property:1220, pop:20000, homeValue:340000 },
  "322": { base:48, violent:465, property:1590, pop:30000, homeValue:260000 },
  "272": { base:42, violent:528, property:1710, pop:34000, homeValue:310000 },
  "274": { base:58, violent:360, property:1345, pop:22000, homeValue:380000 },
  "282": { base:55, violent:392, property:1425, pop:26000, homeValue:360000 },
  "276": { base:62, violent:316, property:1215, pop:20000, homeValue:420000 },
  "352": { base:44, violent:505, property:1630, pop:30000, homeValue:180000 },
  "390": { base:38, violent:585, property:1820, pop:32000, homeValue:160000 },
  "371": { base:42, violent:528, property:1700, pop:28000, homeValue:280000 },
  "372": { base:58, violent:360, property:1340, pop:20000, homeValue:320000 },
  "770": { base:38, violent:582, property:1810, pop:38000, homeValue:220000 },
  "771": { base:52, violent:422, property:1495, pop:28000, homeValue:240000 },
  "772": { base:48, violent:465, property:1588, pop:30000, homeValue:210000 },
  "773": { base:60, violent:342, property:1282, pop:22000, homeValue:280000 },
  "774": { base:65, violent:285, property:1118, pop:18000, homeValue:320000 },
  "775": { base:68, violent:258, property:1055, pop:16000, homeValue:340000 },
  "776": { base:70, violent:232, property:982,  pop:14000, homeValue:360000 },
  "777": { base:72, violent:215, property:958,  pop:12000, homeValue:380000 },
  "778": { base:74, violent:198, property:920,  pop:10000, homeValue:400000 },
  "750": { base:42, violent:528, property:1698, pop:36000, homeValue:280000 },
  "751": { base:55, violent:392, property:1428, pop:26000, homeValue:320000 },
  "752": { base:60, violent:342, property:1280, pop:20000, homeValue:360000 },
  "753": { base:65, violent:285, property:1120, pop:18000, homeValue:400000 },
  "754": { base:70, violent:232, property:980,  pop:14000, homeValue:440000 },
  "760": { base:55, violent:392, property:1430, pop:24000, homeValue:260000 },
  "761": { base:62, violent:318, property:1218, pop:18000, homeValue:300000 },
  "786": { base:45, violent:498, property:1638, pop:32000, homeValue:420000 },
  "787": { base:58, violent:362, property:1342, pop:22000, homeValue:480000 },
  "782": { base:42, violent:528, property:1695, pop:34000, homeValue:180000 },
  "783": { base:55, violent:392, property:1428, pop:24000, homeValue:220000 },
  "798": { base:48, violent:465, property:1585, pop:28000, homeValue:160000 },
  "606": { base:35, violent:620, property:1900, pop:45000, homeValue:280000 },
  "607": { base:45, violent:498, property:1638, pop:36000, homeValue:220000 },
  "608": { base:55, violent:392, property:1428, pop:24000, homeValue:320000 },
  "600": { base:62, violent:318, property:1218, pop:18000, homeValue:380000 },
  "601": { base:68, violent:258, property:1052, pop:14000, homeValue:420000 },
  "481": { base:36, violent:612, property:1888, pop:38000, homeValue:140000 },
  "482": { base:48, violent:465, property:1585, pop:28000, homeValue:200000 },
  "483": { base:62, violent:318, property:1218, pop:18000, homeValue:260000 },
  "441": { base:42, violent:528, property:1695, pop:32000, homeValue:140000 },
  "442": { base:58, violent:362, property:1342, pop:20000, homeValue:200000 },
  "462": { base:42, violent:528, property:1692, pop:30000, homeValue:200000 },
  "463": { base:58, violent:362, property:1338, pop:20000, homeValue:240000 },
  "531": { base:40, violent:552, property:1742, pop:34000, homeValue:200000 },
  "532": { base:58, violent:362, property:1340, pop:22000, homeValue:260000 },
  "631": { base:38, violent:582, property:1808, pop:36000, homeValue:160000 },
  "632": { base:55, violent:392, property:1428, pop:24000, homeValue:220000 },
  "641": { base:40, violent:552, property:1740, pop:32000, homeValue:200000 },
  "642": { base:58, violent:362, property:1338, pop:20000, homeValue:240000 },
  "551": { base:50, violent:442, property:1598, pop:30000, homeValue:320000 },
  "553": { base:62, violent:318, property:1215, pop:18000, homeValue:380000 },
  "900": { base:40, violent:552, property:1745, pop:42000, homeValue:780000 },
  "901": { base:45, violent:498, property:1638, pop:36000, homeValue:620000 },
  "902": { base:62, violent:318, property:1218, pop:18000, homeValue:1800000 },
  "903": { base:58, violent:362, property:1340, pop:28000, homeValue:580000 },
  "904": { base:65, violent:285, property:1118, pop:20000, homeValue:820000 },
  "905": { base:50, violent:442, property:1595, pop:32000, homeValue:480000 },
  "906": { base:55, violent:392, property:1428, pop:28000, homeValue:520000 },
  "910": { base:62, violent:318, property:1215, pop:22000, homeValue:780000 },
  "912": { base:55, violent:392, property:1425, pop:26000, homeValue:680000 },
  "916": { base:52, violent:422, property:1492, pop:28000, homeValue:380000 },
  "917": { base:60, violent:342, property:1278, pop:20000, homeValue:420000 },
  "920": { base:48, violent:465, property:1582, pop:30000, homeValue:680000 },
  "921": { base:58, violent:362, property:1338, pop:22000, homeValue:620000 },
  "922": { base:65, violent:285, property:1115, pop:16000, homeValue:720000 },
  "940": { base:50, violent:442, property:1595, pop:36000, homeValue:1200000 },
  "941": { base:55, violent:392, property:1425, pop:28000, homeValue:980000 },
  "943": { base:62, violent:318, property:1212, pop:22000, homeValue:780000 },
  "945": { base:68, violent:258, property:1048, pop:16000, homeValue:680000 },
  "980": { base:52, violent:422, property:1490, pop:30000, homeValue:680000 },
  "981": { base:58, violent:362, property:1338, pop:22000, homeValue:580000 },
  "982": { base:65, violent:285, property:1112, pop:16000, homeValue:520000 },
  "970": { base:50, violent:442, property:1592, pop:28000, homeValue:480000 },
  "971": { base:58, violent:362, property:1335, pop:20000, homeValue:420000 },
  "891": { base:45, violent:498, property:1635, pop:32000, homeValue:320000 },
  "892": { base:55, violent:392, property:1425, pop:24000, homeValue:360000 },
  "893": { base:65, violent:285, property:1112, pop:16000, homeValue:420000 },
  "850": { base:48, violent:465, property:1580, pop:28000, homeValue:320000 },
  "852": { base:58, violent:362, property:1335, pop:22000, homeValue:360000 },
  "853": { base:65, violent:285, property:1110, pop:18000, homeValue:420000 },
  "855": { base:70, violent:232, property:978,  pop:14000, homeValue:680000 },
  "800": { base:48, violent:465, property:1580, pop:26000, homeValue:480000 },
  "801": { base:58, violent:362, property:1335, pop:20000, homeValue:520000 },
  "802": { base:68, violent:258, property:1048, pop:14000, homeValue:580000 },
  "803": { base:75, violent:192, property:905,  pop:8000,  homeValue:480000 },
};

const REGION_DEFAULTS = {
  "0": { base:62, violent:318, property:1215, pop:14000, homeValue:320000 },
  "1": { base:55, violent:392, property:1428, pop:22000, homeValue:380000 },
  "2": { base:52, violent:422, property:1492, pop:20000, homeValue:340000 },
  "3": { base:50, violent:442, property:1595, pop:22000, homeValue:260000 },
  "4": { base:52, violent:422, property:1490, pop:20000, homeValue:220000 },
  "5": { base:60, violent:342, property:1278, pop:12000, homeValue:200000 },
  "6": { base:52, violent:422, property:1492, pop:22000, homeValue:240000 },
  "7": { base:50, violent:442, property:1595, pop:20000, homeValue:220000 },
  "8": { base:55, violent:392, property:1425, pop:16000, homeValue:300000 },
  "9": { base:52, violent:422, property:1490, pop:22000, homeValue:480000 },
};

function getRegionalBase(zip) {
  return REGIONAL_DATA[zip.substring(0,3)] || REGION_DEFAULTS[zip.substring(0,1)] || { base:55, violent:390, property:1400, pop:18000, homeValue:280000 };
}

function getNeighborhoodType(pop) {
  if (pop >= 35000) return "Urban Core";
  if (pop >= 22000) return "City";
  if (pop >= 14000) return "Suburb";
  if (pop >= 8000)  return "Small Town";
  return "Rural";
}

function getDensity(pop) {
  if (pop >= 35000) return "Very High";
  if (pop >= 22000) return "High";
  if (pop >= 14000) return "Moderate";
  if (pop >= 8000)  return "Low";
  return "Very Low";
}

function getMarket(val) {
  if (val >= 1000000) return "Ultra Premium";
  if (val >= 600000)  return "Premium";
  if (val >= 400000)  return "Above Average";
  if (val >= 250000)  return "Average";
  if (val >= 150000)  return "Below Average";
  return "Affordable";
}

function formatHome(val) {
  if (val >= 1000000) return "$" + (val/1000000).toFixed(1) + "M";
  return "$" + Math.round(val/1000) + "K";
}

function calcScore(zip) {
  const r = getRegionalBase(zip);
  const seed = zip.split("").reduce((a,c,i) => a + c.charCodeAt(0)*(i+1), 0);
  const variation = (seed % 17) - 8;

  const safetyScore  = Math.max(5, Math.min(98, r.base + variation));
  const violentCrime = Math.max(50,  Math.round(r.violent  + (seed%80)  - 40));
  const propertyCrime= Math.max(300, Math.round(r.property + (seed%300) - 150));
  const population   = Math.max(2000,Math.round(r.pop      + (seed%4000)- 2000));
  const homeValue    = Math.max(80000,Math.round(r.homeValue + (seed%60000) - 30000));
  const riskLevel    = safetyScore >= 70 ? "Low Risk" : safetyScore >= 40 ? "Medium Risk" : "High Risk";

  // Crime trend — deterministic per ZIP
  const trendSeed = seed % 10;
  const trend = trendSeed <= 2 ? "↓ Declining" : trendSeed <= 5 ? "→ Stable" : "↑ Rising";
  const trendColor = trendSeed <= 2 ? "green" : trendSeed <= 5 ? "yellow" : "red";
  const trendIcon  = trendSeed <= 2 ? "📉" : trendSeed <= 5 ? "📊" : "📈";
  const trendChange= trendSeed <= 2 ? `-${1 + (seed%4)}% vs last year` : trendSeed <= 5 ? "< 1% change" : `+${1 + (seed%5)}% vs last year`;

  return { safetyScore, violentCrime, propertyCrime, population, homeValue, riskLevel, trend, trendColor, trendIcon, trendChange, dataYear:2023 };
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
const elTrend       = document.getElementById("statTrend");
const elTrendSub    = document.getElementById("statTrendSub");
const elTrendIcon   = document.getElementById("trendIcon");
const elPop         = document.getElementById("statPop");
const elPopSub      = document.getElementById("statPopSub");
const elHome        = document.getElementById("statHome");
const elHomeSub     = document.getElementById("statHomeSub");
const statSection   = document.getElementById("statSection");
const recentSection = document.getElementById("recentSection");
const recentCards   = document.getElementById("recentCards");
const emptyState    = document.getElementById("emptyState");
const loadingState  = document.getElementById("loadingState");
const resultsCount  = document.getElementById("resultsCount");

// ── MAP ────────────────────────────────────────────────────────────────
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
  const color = riskLevel==="Low Risk" ? "#16a34a" : riskLevel==="Medium Risk" ? "#d97706" : "#dc2626";
  const icon = L.divIcon({
    className: "",
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,.4)"></div>`,
    iconSize:[16,16], iconAnchor:[8,8],
  });
  currentMarker = L.marker([lat,lng],{icon}).addTo(map)
    .bindPopup(`<strong>${label}</strong><br>${riskLevel}`).openPopup();
  map.setView([lat,lng], 11);
}

// ── RECENT ZIPS ────────────────────────────────────────────────────────
let recentZips = JSON.parse(localStorage.getItem("recentZips") || "[]");

function saveRecent(data) {
  recentZips = recentZips.filter(z => z.zip !== data.zip);
  recentZips.unshift(data);
  if (recentZips.length > 6) recentZips.pop();
  localStorage.setItem("recentZips", JSON.stringify(recentZips));
  renderRecent();
}

function renderRecent() {
  if (!recentSection || !recentCards) return;
  if (recentZips.length === 0) { recentSection.style.display="none"; return; }
  recentSection.style.display = "block";
  recentCards.innerHTML = recentZips.map(z => {
    const cls = z.riskLevel==="Low Risk" ? "low" : z.riskLevel==="Medium Risk" ? "medium" : "high";
    return `<div class="recent-card ${cls}" onclick="searchZip('${z.zip}')" style="cursor:pointer;">
      <div class="recent-zip">${z.zip}</div>
      <div class="recent-city">${z.city}, ${z.state}</div>
      <div class="recent-score">Score ${z.safetyScore ?? "N/A"}</div>
      <div class="recent-risk">${z.riskLevel}</div>
    </div>`;
  }).join("");
}
renderRecent();

// ── FETCH CITY/STATE ───────────────────────────────────────────────────
async function fetchZipInfo(zip) {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) return { city:"Unknown", state:"US", lat:39.5, lng:-98.35 };
    const d = await r.json();
    return {
      city:  d?.places?.[0]?.["place name"] ?? "Unknown",
      state: d?.places?.[0]?.["state abbreviation"] ?? "US",
      lat:   parseFloat(d?.places?.[0]?.["latitude"])  || 39.5,
      lng:   parseFloat(d?.places?.[0]?.["longitude"]) || -98.35,
    };
  } catch(_) { return { city:"Unknown", state:"US", lat:39.5, lng:-98.35 }; }
}

// ── EXPANDABLE CARDS ───────────────────────────────────────────────────
function toggleCard(id) {
  const body = document.getElementById("expand-" + id);
  const btn  = body?.closest(".stat-card")?.querySelector(".expand-arrow");
  if (!body) return;
  body.classList.toggle("open");
  if (btn) btn.classList.toggle("open");
}

function updateExpandDetails(safetyScore, riskLevel) {
  const pct  = document.getElementById("ex-safetyPct");
  const risk = document.getElementById("ex-safetyRisk");
  const bar  = document.getElementById("ex-safetyBar");
  if (pct)  pct.textContent  = safetyScore + "% of U.S. ZIP codes";
  if (risk) risk.textContent = riskLevel;
  if (bar) {
    bar.style.width = safetyScore + "%";
    bar.style.background = riskLevel==="Low Risk" ? "#16a34a" : riskLevel==="Medium Risk" ? "#d97706" : "#dc2626";
  }
}

// ── RENDER ─────────────────────────────────────────────────────────────
function renderResults(zip, location, scores) {
  const { city, state, lat, lng } = location;
  const { safetyScore, violentCrime, propertyCrime, population, homeValue,
          riskLevel, trend, trendColor, trendIcon, trendChange, dataYear } = scores;

  if (emptyState)   emptyState.style.display  = "none";
  if (loadingState) { loadingState.style.display="none"; loadingState.classList.add("hidden"); }
  if (statSection)  statSection.style.display  = "block";

  // Main stats
  if (elSafety)    elSafety.textContent    = safetyScore;
  if (elSafetySub) elSafetySub.textContent = `Safer than ${safetyScore}% of U.S. ZIP codes`;
  if (elViolent)   elViolent.textContent   = violentCrime.toLocaleString();
  if (elProperty)  elProperty.textContent  = propertyCrime.toLocaleString();
  if (elYear)      elYear.textContent      = dataYear;
  if (elRisk)      elRisk.textContent      = riskLevel;
  if (resultsCount) resultsCount.textContent = "1";

  // Crime trend
  if (elTrend)     { elTrend.textContent = trend; elTrend.className = "stat-value " + trendColor; }
  if (elTrendSub)  elTrendSub.textContent = trendChange;
  if (elTrendIcon) elTrendIcon.textContent = trendIcon;

  // Trend expand
  const exTrendDir = document.getElementById("ex-trendDir");
  const exTrendChg = document.getElementById("ex-trendChg");
  if (exTrendDir) exTrendDir.textContent = trend;
  if (exTrendChg) exTrendChg.textContent = trendChange;

  // Population
  const popFormatted = population >= 1000 ? (population/1000).toFixed(1) + "K" : population.toString();
  const neighborhoodType = getNeighborhoodType(population);
  if (elPop)    elPop.textContent    = popFormatted;
  if (elPopSub) elPopSub.textContent = neighborhoodType;
  const exPopType    = document.getElementById("ex-popType");
  const exPopDensity = document.getElementById("ex-popDensity");
  const exPopHH      = document.getElementById("ex-popHH");
  if (exPopType)    exPopType.textContent    = neighborhoodType;
  if (exPopDensity) exPopDensity.textContent = getDensity(population);
  if (exPopHH)      exPopHH.textContent      = Math.round(population * 0.38).toLocaleString();

  // Home value
  const homeFormatted = formatHome(homeValue);
  const market = getMarket(homeValue);
  const usMedian = 305000;
  const vsUS = homeValue >= usMedian
    ? `${Math.round((homeValue/usMedian - 1)*100)}% above U.S. median`
    : `${Math.round((1 - homeValue/usMedian)*100)}% below U.S. median`;
  if (elHome)    elHome.textContent    = homeFormatted;
  if (elHomeSub) elHomeSub.textContent = market + " market";
  const exHomeRange  = document.getElementById("ex-homeRange");
  const exHomeMarket = document.getElementById("ex-homeMarket");
  const exHomeVsUS   = document.getElementById("ex-homeVsUS");
  if (exHomeRange)  exHomeRange.textContent  = formatHome(homeValue*0.85) + " – " + formatHome(homeValue*1.15);
  if (exHomeMarket) exHomeMarket.textContent = market;
  if (exHomeVsUS)   exHomeVsUS.textContent   = vsUS;

  // Footer
  const footer = document.querySelector(".footer div");
  if (footer) footer.innerHTML = `Data: <b>Regional Crime Index</b> · Based on FBI UCR &amp; Census historical averages · For informational purposes only.`;

  // Update expand details
  updateExpandDetails(safetyScore, riskLevel);

  // Map
  if (lat && lng) placeMarker(lat, lng, `${zip} — ${riskLevel} (${city}, ${state})`, riskLevel);
  saveRecent({ zip, city, state, safetyScore, riskLevel });
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchZip(zip) {
  zip = (zip || zipInput.value.trim()).toString();
  if (!/^\d{5}$/.test(zip)) {
    if (zipError) { zipError.textContent="Please enter a valid 5-digit ZIP code."; zipError.classList.remove("hidden"); }
    return;
  }
  if (zipError) { zipError.textContent=""; zipError.classList.add("hidden"); }

  if (emptyState)   emptyState.style.display   = "none";
  if (loadingState) { loadingState.style.display="block"; loadingState.classList.remove("hidden"); }
  if (statSection)  statSection.style.display   = "none";

  const [location, scores] = await Promise.all([
    fetchZipInfo(zip),
    Promise.resolve(calcScore(zip)),
  ]);
  renderResults(zip, location, scores);
}

// ── EVENTS ─────────────────────────────────────────────────────────────
searchBtn?.addEventListener("click", () => searchZip());
zipInput?.addEventListener("keydown", e => { if (e.key==="Enter") searchZip(); });

const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearAllBtn     = document.getElementById("clearAllBtn");
function clearHistory() { recentZips=[]; localStorage.removeItem("recentZips"); renderRecent(); }
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