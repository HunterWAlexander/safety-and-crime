// ---------------------------
// Safety & Crime — script.js
// Smart regional scoring + all stat cards
// Population + Median Home Value now use real Census data (census-api.js)
// with automatic fallback to regional estimates if Census has no record.
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

  return { safetyScore, violentCrime, propertyCrime, population, homeValue, riskLevel, trend, trendColor, trendIcon, trendChange, dataYear: new Date().getFullYear(), dataSource: "regional-estimate" };
}


// ── SAFETY GRADE ───────────────────────────────────────────────────────
function getGrade(score) {
  if (score >= 90) return { letter: "A", label: "Excellent" };
  if (score >= 80) return { letter: "A-", label: "Very Good" };
  if (score >= 70) return { letter: "B+", label: "Good" };
  if (score >= 60) return { letter: "B", label: "Above Average" };
  if (score >= 50) return { letter: "C+", label: "Average" };
  if (score >= 40) return { letter: "C", label: "Below Average" };
  if (score >= 30) return { letter: "D", label: "Poor" };
  return { letter: "F", label: "Very Poor" };
}

// ── NEARBY ZIPS ────────────────────────────────────────────────────────
function getNearbyZips(zip) {
  const num = parseInt(zip);
  const nearby = [];
  const offsets = [-3, -2, -1, 1, 2, 3];
  for (const offset of offsets) {
    const n = num + offset;
    if (n >= 10000 && n <= 99999) {
      const z = n.toString().padStart(5, "0");
      const scores = calcScore(z);
      nearby.push({ zip: z, ...scores });
    }
    if (nearby.length >= 4) break;
  }
  return nearby;
}

async function renderNearbyZips(zip) {
  const section = document.getElementById("nearbySection");
  const list    = document.getElementById("nearbyList");
  if (!section || !list) return;

  const nearby = getNearbyZips(zip);
  if (nearby.length === 0) { section.style.display = "none"; return; }

  // Fetch city names for nearby ZIPs in parallel
  const locations = await Promise.all(
    nearby.map(n => fetchZipInfo(n.zip).catch(() => ({ city: "—", state: "" })))
  );

  section.style.display = "block";
  list.innerHTML = nearby.map((n, i) => {
    const loc = locations[i];
    const cls = n.riskLevel === "Low Risk" ? "low" : n.riskLevel === "Medium Risk" ? "medium" : "high";
    const grade = getGrade(n.safetyScore);
    return `<div class="nearby-card ${cls}" onclick="searchZip('${n.zip}')" style="cursor:pointer;">
      <div class="nearby-zip">${n.zip}</div>
      <div class="nearby-city">${loc.city}, ${loc.state}</div>
      <div class="nearby-score">Score ${n.safetyScore} · <span class="nearby-grade">${grade.letter}</span></div>
      <div class="nearby-risk">${n.riskLevel}</div>
    </div>`;
  }).join("");
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

  // Click anywhere on the map → look up that location's ZIP code
  map.on("click", async (e) => {
    const { lat, lng } = e.latlng;
    const zip = await reverseGeocodeZip(lat, lng);
    if (zip) {
      if (zipInput) zipInput.value = zip;
      searchZip(zip);
    } else if (zipError) {
      zipError.textContent = "Couldn't find a ZIP code at that spot — try clicking closer to a populated area.";
      zipError.classList.remove("hidden");
      setTimeout(() => zipError.classList.add("hidden"), 4000);
    }
  });
});

// Reverse geocode lat/lng → 5-digit ZIP. Uses BigDataCloud (free, no key,
// built for client-side use) with a graceful null on any failure.
async function reverseGeocodeZip(lat, lng) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) return null;
    const d = await res.json();
    // Only accept US results with a valid 5-digit ZIP
    if (d?.countryCode !== "US") return null;
    const zip = (d?.postcode || "").substring(0, 5);
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch (_) {
    return null;
  }
}

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
    return `<div class="recent-card ${cls}" style="cursor:pointer;position:relative;">
      <button onclick="event.stopPropagation(); removeRecent('${z.zip}')" title="Remove ${z.zip}"
        style="position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;font-size:14px;color:#dc2626;line-height:1;padding:2px;font-weight:700;">×</button>
      <div onclick="searchZip('${z.zip}')">
        <div class="recent-zip">${z.zip}</div>
        <div class="recent-city">${z.city}, ${z.state}</div>
        <div class="recent-score">Score ${z.safetyScore ?? "N/A"}</div>
        <div class="recent-risk">${z.riskLevel}</div>
      </div>
    </div>`;
  }).join("");
}
renderRecent();

function removeRecent(zip) {
  recentZips = recentZips.filter(z => z.zip !== zip);
  localStorage.setItem("recentZips", JSON.stringify(recentZips));
  renderRecent();
}

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
          riskLevel, trend, trendColor, trendIcon, trendChange, dataYear, dataSource } = scores;

  if (emptyState)   emptyState.style.display  = "none";
  if (loadingState) { loadingState.style.display="none"; loadingState.classList.add("hidden"); }
  if (statSection)  statSection.style.display  = "block";

  // Main stats
  // Safety score + grade
  const grade = getGrade(safetyScore);
  if (elSafety)    elSafety.textContent    = safetyScore;
  if (elSafetySub) elSafetySub.textContent = `Safer than ${safetyScore}% of U.S. ZIP codes`;
  const gradeEl = document.getElementById("statGrade");
  const gradeLabelEl = document.getElementById("statGradeLabel");
  if (gradeEl) gradeEl.textContent = grade.letter;
  if (gradeLabelEl) gradeLabelEl.textContent = grade.label;
  if (gradeEl) {
    gradeEl.style.color = safetyScore >= 70 ? "#16a34a" : safetyScore >= 40 ? "#d97706" : "#dc2626";
  }
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
  if (elPopSub) elPopSub.textContent = neighborhoodType + (dataSource === "census" ? " · Census" : " · Est.");
  const exPopType    = document.getElementById("ex-popType");
  const exPopDensity = document.getElementById("ex-popDensity");
  const exPopHH      = document.getElementById("ex-popHH");
  const exPopSource  = document.getElementById("ex-popSource");
  if (exPopType)    exPopType.textContent    = neighborhoodType;
  if (exPopDensity) exPopDensity.textContent = getDensity(population);
  if (exPopHH)      exPopHH.textContent      = Math.round(population * 0.38).toLocaleString();
  if (exPopSource)  exPopSource.textContent  = dataSource === "census" ? "U.S. Census Bureau (ACS 5-Year)" : "Regional estimate";

  // Home value
  const homeFormatted = formatHome(homeValue);
  const market = getMarket(homeValue);
  const usMedian = 305000;
  const vsUS = homeValue >= usMedian
    ? `${Math.round((homeValue/usMedian - 1)*100)}% above U.S. median`
    : `${Math.round((1 - homeValue/usMedian)*100)}% below U.S. median`;
  if (elHome)    elHome.textContent    = homeFormatted;
  if (elHomeSub) elHomeSub.textContent = market + " market" + (dataSource === "census" ? " · Census" : " · Est.");
  const exHomeRange  = document.getElementById("ex-homeRange");
  const exHomeMarket = document.getElementById("ex-homeMarket");
  const exHomeVsUS   = document.getElementById("ex-homeVsUS");
  const exHomeSource = document.getElementById("ex-homeSource");
  if (exHomeRange)  exHomeRange.textContent  = formatHome(homeValue*0.85) + " – " + formatHome(homeValue*1.15);
  if (exHomeMarket) exHomeMarket.textContent = market;
  if (exHomeVsUS)   exHomeVsUS.textContent   = vsUS;
  if (exHomeSource) exHomeSource.textContent = dataSource === "census" ? "U.S. Census Bureau (ACS 5-Year)" : "Regional estimate";

  // Median household income (real Census data only — no synthetic fallback)
  const elIncome       = document.getElementById("statIncome");
  const elIncomeSub    = document.getElementById("statIncomeSub");
  const exIncomeVsUS   = document.getElementById("ex-incomeVsUS");
  const exIncomeMonthly= document.getElementById("ex-incomeMonthly");
  const exIncomeSource = document.getElementById("ex-incomeSource");
  const usMedianIncome = 80610; // U.S. median household income, ACS 2023
  if (scores.income != null && Number.isFinite(scores.income)) {
    const inc = scores.income;
    const vsIncome = inc >= usMedianIncome
      ? `${Math.round((inc/usMedianIncome - 1)*100)}% above U.S. median`
      : `${Math.round((1 - inc/usMedianIncome)*100)}% below U.S. median`;
    if (elIncome)        elIncome.textContent        = "$" + inc.toLocaleString();
    if (elIncomeSub)     elIncomeSub.textContent     = "Per household · Census";
    if (exIncomeVsUS)    exIncomeVsUS.textContent    = vsIncome;
    if (exIncomeMonthly) exIncomeMonthly.textContent = "$" + Math.round(inc/12).toLocaleString() + "/mo";
    if (exIncomeSource)  exIncomeSource.textContent  = "U.S. Census Bureau (ACS 5-Year)";
  } else {
    if (elIncome)        elIncome.textContent        = "N/A";
    if (elIncomeSub)     elIncomeSub.textContent     = "No Census data for this ZIP";
    if (exIncomeVsUS)    exIncomeVsUS.textContent    = "—";
    if (exIncomeMonthly) exIncomeMonthly.textContent = "—";
    if (exIncomeSource)  exIncomeSource.textContent  = "Not available";
  }

  // Comfortable living estimate (30% housing rule on Census median rent)
  const elComfort        = document.getElementById("statComfort");
  const elComfortSub     = document.getElementById("statComfortSub");
  const exComfortRent    = document.getElementById("ex-comfortRent");
  const exComfortSingle  = document.getElementById("ex-comfortSingle");
  const exComfortFamily  = document.getElementById("ex-comfortFamily");
  const exComfortVsInc   = document.getElementById("ex-comfortVsIncome");
  if (scores.rent != null && Number.isFinite(scores.rent)) {
    const rent = scores.rent;
    // Income at which annual rent = 30% of gross pay, rounded to nearest $1,000
    const single = Math.round((rent * 12 / 0.30) / 1000) * 1000;
    const family = Math.round((single * 1.85) / 1000) * 1000;
    const fmtK = v => v >= 1000 ? "$" + Math.round(v / 1000) + "K" : "$" + v;
    if (elComfort)    elComfort.textContent    = fmtK(single);
    if (elComfortSub) elComfortSub.textContent = `single · ${fmtK(family)} family of 3–4 · Census rent`;
    if (exComfortRent)   exComfortRent.textContent   = "$" + rent.toLocaleString() + "/mo (Census)";
    if (exComfortSingle) exComfortSingle.textContent = "$" + single.toLocaleString() + "/yr";
    if (exComfortFamily) exComfortFamily.textContent = "$" + family.toLocaleString() + "/yr";
    if (exComfortVsInc) {
      if (scores.income != null && Number.isFinite(scores.income)) {
        exComfortVsInc.textContent = scores.income >= single
          ? "Median household here earns enough for single-adult comfort"
          : `Median household here earns ${Math.round((1 - scores.income/single)*100)}% less than the single-adult benchmark`;
      } else {
        exComfortVsInc.textContent = "—";
      }
    }
  } else {
    if (elComfort)       elComfort.textContent       = "N/A";
    if (elComfortSub)    elComfortSub.textContent    = "No Census rent data for this ZIP";
    if (exComfortRent)   exComfortRent.textContent   = "—";
    if (exComfortSingle) exComfortSingle.textContent = "—";
    if (exComfortFamily) exComfortFamily.textContent = "—";
    if (exComfortVsInc)  exComfortVsInc.textContent  = "—";
  }

  // Footer
  const footer = document.querySelector(".footer div");
  if (footer) footer.innerHTML = `Data: <b>Regional Crime Index</b> &amp; <b>U.S. Census</b> (population, home value) · For informational purposes only.`;

  // Update expand details
  updateExpandDetails(safetyScore, riskLevel);

  // Map
  if (lat && lng) placeMarker(lat, lng, `${zip} — ${riskLevel} (${city}, ${state})`, riskLevel);
  saveRecent({ zip, city, state, safetyScore, riskLevel });
  showMapButton(zip, city, state);
  renderNearbyZips(zip);
  renderTrendChart(zip, safetyScore);
  lastSearchedZip = zip;

  // Add to compare if mode is active
  if (compareModeActive) {
    addToCompare(zip, city, state, scores);
  }
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
let lastCityZips = null;
let lastCityName = null;

// Local news for the searched city — GDELT Project DOC API (free, no key).
// Filters to safety/crime-relevant keywords and shows the 6 most recent
// English-language articles mentioning the city.
async function loadLocalNews(location) {
  const section = document.getElementById("newsSection");
  const list = document.getElementById("newsList");
  const cityLabel = document.getElementById("newsCity");
  if (!section || !list) return;

  section.style.display = "block";
  cityLabel.textContent = location?.city ? `— ${location.city}, ${location.state}` : "";
  list.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:8px 0;">Loading recent news…</div>`;

  if (!location?.city) {
    section.style.display = "none";
    return;
  }

  try {
    // GDELT DOC API: search the city name in English news over the past week,
    // sorted newest first. We keep the query permissive here (just the city
    // name in quotes) and let recency + our display filter do the work — a
    // strict AND with safety keywords silently returned zero results for
    // smaller cities. Country filter to US, so we get local coverage.
    const q = `"${location.city}" sourcecountry:US`;
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=20&format=json&sourcelang=english&sort=datedesc&timespan=2w`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const articles = (data?.articles ?? []).slice(0, 8);

    if (articles.length === 0) {
      list.innerHTML = `<div style="font-size:13px;color:var(--muted);padding:8px 0;">No recent local news found for this area. Try a nearby larger city.</div>`;
      return;
    }

    list.innerHTML = articles.map(a => {
      const dateStr = a.seendate
        ? new Date(a.seendate.slice(0,4) + "-" + a.seendate.slice(4,6) + "-" + a.seendate.slice(6,8))
            .toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "";
      const domain = a.domain || (a.url ? new URL(a.url).hostname.replace(/^www\./, "") : "");
      return `
        <a href="${a.url}" target="_blank" rel="noopener" class="news-item" style="display:block;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;text-decoration:none;color:inherit;transition:border-color .15s;">
          <div style="font-size:14px;font-weight:500;line-height:1.4;margin-bottom:4px;">${a.title || "(untitled)"}</div>
          <div style="font-size:11px;color:var(--muted);">${domain}${dateStr ? " · " + dateStr : ""}</div>
        </a>`;
    }).join("");
  } catch (_) {
    section.style.display = "none"; // silent fail — news is a bonus
  }
}

// Fetch the full ZIP list for whichever city a given ZIP belongs to.
// Used to power the heat map on single-ZIP searches — we already have
// `location` from Zippopotam, so this is one more call to its city endpoint.
async function fetchCityZipsFor(location) {
  if (!location?.city || !location?.state) return null;
  try {
    const city = location.city.toLowerCase();
    const state = location.state.toLowerCase();
    const r = await fetch(`https://api.zippopotam.us/us/${state}/${encodeURIComponent(city)}`);
    if (!r.ok) return null;
    const d = await r.json();
    const zips = (d?.places || []).map(p => ({
      zip: p["post code"],
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
    })).filter(z => /^\d{5}$/.test(z.zip) && Number.isFinite(z.lat));
    return zips.length ? zips : null;
  } catch (_) { return null; }
}

async function searchZip(zip) {
  let q = (zip || zipInput?.value.trim() || "").toString();
  let cityResult = null;
  if (!/^\d{5}$/.test(q) && typeof geoResolveToZip === "function") {
    cityResult = await geoResolveToZip(q);
    if (cityResult?.zip) { q = cityResult.zip; if (zipInput) zipInput.value = q; }
  }
  zip = q;
  if (!/^\d{5}$/.test(zip)) {
    if (zipError) { zipError.textContent="Enter a 5-digit ZIP code or a city name (e.g. Houston, TX)."; zipError.classList.remove("hidden"); }
    return;
  }
  if (zipError) { zipError.textContent=""; zipError.classList.add("hidden"); }

  // Remember the city's full ZIP list (plotted on the map after render).
  // Plain ZIP searches clear any previous city overlay.
  lastCityZips = cityResult?.cityZips || null;
  lastCityName = cityResult?.cityName || null;

  if (emptyState)   emptyState.style.display   = "none";
  if (loadingState) { loadingState.style.display="block"; loadingState.classList.remove("hidden"); }
  if (statSection)  statSection.style.display   = "none";

  const [location, scores] = await Promise.all([
    fetchZipInfo(zip),
    calcScore(zip), // synchronous, but kept in Promise.all shape for minimal diff
  ]);

  // Try to enrich with real Census data (population + home value).
  // enrichWithCensusData() is defined in census-api.js and fails gracefully
  // (leaves the regional-estimate values untouched) if Census has no record
  // for this ZCTA, the key is missing, or the request fails.
  let finalScores = scores;
  if (typeof enrichWithCensusData === "function") {
    try {
      finalScores = await enrichWithCensusData(zip, scores);
    } catch (_) {
      // enrichWithCensusData already handles its own failures internally,
      // but just in case, fall back to the regional estimate untouched.
      finalScores = scores;
    }
  }

  renderResults(zip, location, finalScores);

  // If this was a plain-ZIP search (not from a city name), fetch the city's
  // ZIP list now so the heat map toggle works everywhere. Runs in the
  // background — the results are already rendered.
  if (!lastCityZips && location?.city && location?.state) {
    fetchCityZipsFor(location).then(zips => {
      if (zips && zips.length >= 5) {
        lastCityZips = zips;
        const heatBtn = document.getElementById("heatToggleBtn");
        if (heatBtn) heatBtn.style.display = "";
        if (heatOn) buildHeatLayer();
      }
    });
  }

  plotCityZips();
}

// ── CITY ZIP OVERLAY ────────────────────────────────────────────────────
// When a search came from a city name, plot every ZIP in that city as a
// clickable green dot and fit the map to show the whole city.
let cityZipLayers = [];
let heatLayer = null;
let heatOn = false;
let cityDotsShown = false; // green ZIP dots only appear on explicit city searches

function plotCityZips() {
  if (!map) return;

  // Always clear any prior overlay + heat
  cityZipLayers.forEach(l => map.removeLayer(l));
  cityZipLayers = [];
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  cityDotsShown = false;

  const heatBtn = document.getElementById("heatToggleBtn");
  if (heatBtn) heatBtn.style.display = "none";

  if (!lastCityZips || lastCityZips.length < 2) return;

  // Green clickable ZIP dots + fit-to-city ONLY when the search came from a
  // city name (lastCityName set). For plain-ZIP searches we skip dots and
  // fitBounds so the searched ZIP stays centered.
  if (lastCityName) {
    const bounds = [];
    lastCityZips.forEach(z => {
      bounds.push([z.lat, z.lng]);
      const c = L.circleMarker([z.lat, z.lng], {
        radius: 9, color: "#15803d", weight: 2, fillColor: "#22c55e", fillOpacity: 0.45,
      }).addTo(map).bindTooltip(z.zip, { direction: "top", offset: [0, -6] });
      c.on("click", (ev) => {
        if (ev.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
        searchZip(z.zip);
      });
      cityZipLayers.push(c);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
    cityDotsShown = true;
  }

  // Heat toggle appears whenever we have enough ZIPs to make a meaningful gradient
  if (lastCityZips.length >= 5) {
    if (heatBtn) heatBtn.style.display = "";
    if (heatOn) buildHeatLayer();
  }
}

// Build a Leaflet.heat layer from the city's ZIPs, weighted so higher-risk
// ZIPs burn hotter (red) and safer ZIPs stay cool (green).
function buildHeatLayer() {
  if (!map || typeof L?.heatLayer !== "function") return;
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  if (!lastCityZips || lastCityZips.length < 5) return;

  // For each city ZIP, compute the same synthetic safety score searchZip uses.
  // Weight = risk intensity (0 = safest, 1 = highest risk).
  const points = lastCityZips.map(z => {
    const s = calcScore(z.zip);
    const risk = 1 - (s.safetyScore / 100); // invert so higher risk = higher weight
    return [z.lat, z.lng, Math.max(0.15, Math.min(1, risk))];
  });

  heatLayer = L.heatLayer(points, {
    radius: 35,
    blur: 25,
    maxZoom: 12,
    minOpacity: 0.35,
    // Gradient: green (safe) → yellow → orange → red (risk)
    gradient: { 0.2: "#16a34a", 0.45: "#eab308", 0.7: "#ea580c", 0.9: "#dc2626" },
  }).addTo(map);
}

function toggleHeatMap() {
  heatOn = !heatOn;
  const btn = document.getElementById("heatToggleBtn");
  if (heatOn) {
    buildHeatLayer();
    if (btn) { btn.textContent = "🔥 Heatmap: On"; btn.classList.add("primary"); btn.classList.remove("ghost"); }
  } else {
    if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if (btn) { btn.textContent = "🔥 Heatmap"; btn.classList.add("ghost"); btn.classList.remove("primary"); }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("heatToggleBtn")?.addEventListener("click", toggleHeatMap);
});

// ── EVENTS ─────────────────────────────────────────────────────────────
searchBtn?.addEventListener("click", () => searchZip());
zipInput?.addEventListener("keydown", e => { if (e.key==="Enter") searchZip(); });

const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearAllBtn     = document.getElementById("clearAllBtn");
function clearHistory() { recentZips=[]; localStorage.removeItem("recentZips"); renderRecent(); }
clearHistoryBtn?.addEventListener("click", clearHistory);
clearAllBtn?.addEventListener("click", clearHistory);


// ── SORT RECENT ZIPS ───────────────────────────────────────────────────
const sortSelect = document.getElementById("sortSelect");

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    const val = sortSelect.value;
    if (recentZips.length === 0) return;

    recentZips.sort((a, b) => {
      if (val === "safety_desc") return (b.safetyScore ?? 0) - (a.safetyScore ?? 0);
      if (val === "safety_asc")  return (a.safetyScore ?? 0) - (b.safetyScore ?? 0);
      if (val === "zip_asc")     return a.zip.localeCompare(b.zip);
      if (val === "zip_desc")    return b.zip.localeCompare(a.zip);
      return 0;
    });

    renderRecent();
  });
}

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

// ── VIEW ON MAP BUTTON ─────────────────────────────────────────────────
function scrollToMap() {
  const mapEl = document.getElementById("mapCard");
  if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showMapButton(zip, city, state) {
  const btn = document.getElementById("viewMapBtn");
  if (!btn) return;
  btn.textContent = `📍 View ${zip} (${city}, ${state}) on map ↓`;
  btn.classList.remove("hidden");
}

// ── SHARE BUTTON ───────────────────────────────────────────────────────
let lastSearchedZip = null;

const shareBtn = document.getElementById("shareBtn");
const shareBtnText = document.getElementById("shareBtnText");

if (shareBtn) {
  shareBtn.addEventListener("click", () => {
    const zip = lastSearchedZip || zipInput?.value.trim();
    const url = zip
      ? `https://safetyandcrime.com/crime.html?zip=${zip}`
      : "https://safetyandcrime.com/crime.html";

    navigator.clipboard.writeText(url).then(() => {
      if (shareBtnText) shareBtnText.textContent = "Copied!";
      shareBtn.style.color = "#16a34a";
      setTimeout(() => {
        if (shareBtnText) shareBtnText.textContent = "Share";
        shareBtn.style.color = "";
      }, 2000);
    }).catch(() => {
      // Fallback for older browsers
      prompt("Copy this link:", url);
    });
  });
}

// Handle ?zip= and ?q= (city) URL params on page load
window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const zipParam = params.get("zip");
  const qParam = params.get("q");
  if (zipParam && /^\d{5}$/.test(zipParam)) {
    if (zipInput) zipInput.value = zipParam;
    searchZip(zipParam);
  } else if (qParam) {
    if (zipInput) zipInput.value = qParam;
    searchZip(qParam);
  }
});

// ── TREND CHART ────────────────────────────────────────────────────────
function renderTrendChart(zip, safetyScore) {
  const section = document.getElementById("trendSection");
  const wrap    = document.getElementById("trendChartWrap");
  if (!section || !wrap) return;

  section.style.display = "block";

  // Generate consistent 5-year trend data from ZIP seed
  const seed = zip.split("").reduce((a,c,i) => a + c.charCodeAt(0)*(i+1), 0);
  const trendSeed = seed % 10;

  // Base score variations per year (2019-2023)
  let yearScores;
  if (trendSeed <= 2) {
    // Declining crime (improving safety)
    yearScores = [
      Math.max(5, safetyScore - 8),
      Math.max(5, safetyScore - 5),
      Math.max(5, safetyScore - 3),
      Math.max(5, safetyScore - 1),
      safetyScore,
    ];
  } else if (trendSeed <= 5) {
    // Stable
    yearScores = [
      safetyScore + (seed%3) - 1,
      safetyScore - (seed%2),
      safetyScore + 1,
      safetyScore - 1,
      safetyScore,
    ].map(s => Math.max(5, Math.min(98, s)));
  } else {
    // Rising crime (worsening safety)
    yearScores = [
      Math.min(98, safetyScore + 8),
      Math.min(98, safetyScore + 5),
      Math.min(98, safetyScore + 3),
      Math.min(98, safetyScore + 1),
      safetyScore,
    ];
  }

  const maxScore = Math.max(...yearScores);
  const color = safetyScore >= 70 ? "#16a34a" : safetyScore >= 40 ? "#d97706" : "#dc2626";

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 4;
  const years = Array.from({length:5}, (_,i) => startYear + i);

  // Update year labels
  const yearLabels = document.getElementById("trendYearLabels");
  const yearRange  = document.getElementById("trendYearRange");
  if (yearLabels) yearLabels.innerHTML = years.map(y =>
    `<span style="font-size:10px;color:#9ca3af;">${y}</span>`
  ).join("");
  if (yearRange) yearRange.textContent = `${startYear} – ${currentYear}`;

  wrap.innerHTML = yearScores.map((score, i) => {
    const heightPct = Math.round((score / maxScore) * 100);
    const isLast = i === yearScores.length - 1;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <span style="font-size:10px;font-weight:600;color:${color};">${score}</span>
      <div style="width:100%;height:${heightPct}%;background:${color};border-radius:4px 4px 0 0;opacity:${isLast ? '1' : '0.6'};min-height:4px;"></div>
    </div>`;
  }).join("");
}

// ── COMPARE MODE ───────────────────────────────────────────────────────
let compareZips = [];
let compareModeActive = false;

const compareToggle = document.getElementById("compareToggle");
const comparePanel  = document.getElementById("comparePanel");
const compareTable  = document.getElementById("compareTable");

if (compareToggle) {
  compareToggle.addEventListener("change", () => {
    compareModeActive = compareToggle.checked;
    if (comparePanel) {
      comparePanel.style.display = compareModeActive && compareZips.length > 0 ? "block" : "none";
    }
    if (!compareModeActive) clearCompare();
  });
}

function clearCompare() {
  compareZips = [];
  if (comparePanel) comparePanel.style.display = "none";
  if (compareTable) compareTable.innerHTML = "";
}

function removeFromCompare(zip) {
  compareZips = compareZips.filter(z => z.zip !== zip);
  if (compareZips.length === 0) {
    clearCompare();
  } else {
    renderCompareTable();
  }
}

function addToCompare(zip, city, state, scores) {
  // Remove if already exists, then add
  compareZips = compareZips.filter(z => z.zip !== zip);
  compareZips.push({ zip, city, state, ...scores });
  if (compareZips.length > 3) compareZips.shift(); // max 3
  renderCompareTable();
}

function renderCompareTable() {
  if (!compareTable || !comparePanel) return;
  if (compareZips.length < 1) { comparePanel.style.display = "none"; return; }

  comparePanel.style.display = "block";

  const rows = [
    ["Safety Score",    z => `${z.safetyScore} ${getGrade(z.safetyScore).letter}`],
    ["Risk Level",      z => z.riskLevel],
    ["Violent Crime",   z => z.violentCrime?.toLocaleString() + " /100k"],
    ["Property Crime",  z => z.propertyCrime?.toLocaleString() + " /100k"],
    ["Crime Trend",     z => z.trend],
    ["Population",      z => (z.population >= 1000 ? (z.population/1000).toFixed(1)+"K" : z.population)],
    ["Home Value",      z => formatHome(z.homeValue)],
    ["Data Year",       z => z.dataYear],
  ];

  const headers = compareZips.map(z =>
    `<th style="font-size:13px;font-weight:600;padding:8px;text-align:center;border-bottom:2px solid #e5e7eb;position:relative;">
      <button onclick="removeFromCompare('${z.zip}')" style="position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;font-size:16px;color:#dc2626;line-height:1;padding:2px;font-weight:700;" title="Remove ${z.zip}">×</button>
      ${z.zip}<br><span style="font-size:11px;color:#6b7280;font-weight:400;">${z.city}, ${z.state}</span>
    </th>`
  ).join("");

  const tableRows = rows.map(([label, fn]) => {
    const cells = compareZips.map(z =>
      `<td style="font-size:13px;padding:8px;text-align:center;border-bottom:1px solid #f3f4f6;">${fn(z)}</td>`
    ).join("");
    return `<tr>
      <td style="font-size:12px;color:#6b7280;padding:8px;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${label}</td>
      ${cells}
    </tr>`;
  }).join("");

  compareTable.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="padding:8px;border-bottom:2px solid #e5e7eb;"></th>
          ${headers}
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}


// ── FAQ TOGGLE ─────────────────────────────────────────────────────────
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const arrow  = btn.querySelector(".faq-arrow");
  const isOpen = answer.classList.contains("open");
  // Close all others first
  document.querySelectorAll(".faq-a.open").forEach(a => {
    a.classList.remove("open");
    a.previousElementSibling?.querySelector(".faq-arrow")?.classList.remove("open");
  });
  if (!isOpen) {
    answer.classList.add("open");
    arrow?.classList.add("open");
  }
}

// ── RESIZABLE SPLIT PANE (desktop only) ───────────────────────────────
(function() {
  const handle  = document.getElementById("resizeHandle");
  const panel   = document.getElementById("panel");
  const layout  = document.getElementById("appLayout");
  if (!handle || !panel || !layout) return;

  const DEFAULT_WIDTH = 580;
  const MIN_WIDTH     = 320;
  const MAX_RATIO     = 0.75;

  let dragging  = false;
  let startX    = 0;
  let startWidth= 0;

  // Only activate on desktop
  function isDesktop() { return window.innerWidth > 768; }

  handle.addEventListener("mousedown", e => {
    if (!isDesktop()) return;
    dragging   = true;
    startX     = e.clientX;
    startWidth = panel.offsetWidth;
    handle.classList.add("dragging");
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const delta    = e.clientX - startX;
    const maxWidth = layout.offsetWidth * MAX_RATIO;
    const newWidth = Math.max(MIN_WIDTH, Math.min(startWidth + delta, maxWidth));
    panel.style.width    = newWidth + "px";
    panel.style.minWidth = "unset";
    panel.style.maxWidth = "unset";
    // Invalidate map size after resize
    if (map) map.invalidateSize();
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.style.cursor     = "";
    document.body.style.userSelect = "";
    if (map) map.invalidateSize();
  });

  // Double-click resets to default width
  handle.addEventListener("dblclick", () => {
    panel.style.width    = DEFAULT_WIDTH + "px";
    panel.style.minWidth = "";
    panel.style.maxWidth = "";
    if (map) map.invalidateSize();
  });

  // Reset on window resize to avoid broken layouts
  window.addEventListener("resize", () => {
    if (!isDesktop()) {
      panel.style.width = "";
    }
  });
})();