// ---------------------------
// Safety & Crime — script.js
// Calls /functions/zip.js for real FBI + Census data
// ---------------------------

const zipInput   = document.getElementById("zipInput");
const zipError   = document.getElementById("zipError");
const searchBtn  = document.getElementById("searchBtn");
const resultsEl  = document.getElementById("results");
const compareBtn = document.getElementById("compareBtn");
const focusBtn   = document.getElementById("focusBtn");

// Stat card elements
const elScore       = document.getElementById("statScore");
const elScoreSub    = document.getElementById("statScoreSub");
const elViolent     = document.getElementById("statViolent");
const elProperty    = document.getElementById("statProperty");
const elYear        = document.getElementById("statYear");
const elRisk        = document.getElementById("statRisk");
const elRiskBadge   = document.getElementById("riskBadge");
const elCity        = document.getElementById("resultCity");

// Recent ZIPs
const recentStrip   = document.getElementById("recentStrip");
const recentList    = document.getElementById("recentList");

// Compare panel
const comparePanel  = document.getElementById("comparePanel");
const compareInputA = document.getElementById("compareZipA");
const compareInputB = document.getElementById("compareZipB");
const compareRunBtn = document.getElementById("compareRunBtn");
const compareOutput = document.getElementById("compareOutput");

// ── MAP SETUP ──────────────────────────────────────────────────────────
let map = L.map("map").setView([39.5, -98.35], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

let currentMarker = null;

function placeMarker(lat, lng, label, riskLevel) {
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
  if (recentZips.length === 0) {
    recentStrip.style.display = "none";
    return;
  }
  recentStrip.style.display = "block";
  recentList.innerHTML = recentZips
    .map((z) => {
      const cls =
        z.riskLevel === "Low Risk"    ? "low" :
        z.riskLevel === "Medium Risk" ? "medium" : "high";
      return `
        <div class="recent-card ${cls}" onclick="searchZip('${z.zip}')">
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

// ── MOCK FALLBACK (used if real data unavailable) ──────────────────────
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

  // Show the results section
  resultsEl.style.display = "block";

  // City header
  if (elCity) elCity.textContent = `${city}, ${state} — ${zip}`;

  // Safety score
  if (elScore) elScore.textContent = safetyScore ?? "N/A";
  if (elScoreSub) {
    elScoreSub.textContent = safetyScore
      ? `Safer than ${safetyScore}% of U.S.`
      : "Score unavailable";
  }

  // Crime counts
  if (elViolent)   elViolent.textContent   = violentCrime  != null ? violentCrime.toLocaleString()  : "N/A";
  if (elProperty)  elProperty.textContent  = propertyCrime != null ? propertyCrime.toLocaleString() : "N/A";
  if (elYear)      elYear.textContent      = dataYear ?? "N/A";

  // Risk level badge
  if (elRisk) elRisk.textContent = riskLevel;
  if (elRiskBadge) {
    elRiskBadge.className = "risk-badge " +
      (riskLevel === "Low Risk" ? "low" :
       riskLevel === "Medium Risk" ? "medium" : "high");
    elRiskBadge.textContent = riskLevel;
  }

  // Data source note
  const noteEl = document.getElementById("dataNote");
  if (noteEl) {
    noteEl.textContent = hasRealData
      ? `Real data from FBI UCR · ${dataYear}`
      : "⚠️ Using estimated data — real FBI data unavailable for this area";
    noteEl.style.color = hasRealData ? "#16a34a" : "#d97706";
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
    if (zipError) zipError.textContent = "Please enter a valid 5-digit ZIP code.";
    return;
  }
  if (zipError) zipError.textContent = "";

  // Show skeleton loading
  resultsEl.style.display = "block";
  document.querySelectorAll(".stat-value").forEach((el) => {
    el.textContent = "—";
  });

  let data;
  try {
    data = await fetchZipData(zip);
    // If the function returned but has no real data, blend with mock for display
    if (!data.hasRealData) {
      const mock = mockData(zip);
      data = { ...mock, ...data, hasRealData: false };
    }
  } catch (err) {
    console.warn("Cloudflare function error, using mock data:", err);
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

// ── COMPARE MODE ───────────────────────────────────────────────────────
if (compareBtn) {
  compareBtn.addEventListener("click", () => {
    if (comparePanel) {
      comparePanel.style.display =
        comparePanel.style.display === "none" ? "block" : "none";
    }
  });
}

if (compareRunBtn) {
  compareRunBtn.addEventListener("click", async () => {
    const zipA = compareInputA?.value.trim();
    const zipB = compareInputB?.value.trim();
    if (!/^\d{5}$/.test(zipA) || !/^\d{5}$/.test(zipB)) {
      if (compareOutput) compareOutput.innerHTML = "<p>Please enter two valid ZIP codes.</p>";
      return;
    }

    if (compareOutput) compareOutput.innerHTML = "<p>Loading comparison…</p>";

    try {
      const [a, b] = await Promise.all([fetchZipData(zipA), fetchZipData(zipB)]);

      const row = (label, va, vb) => `
        <tr>
          <td>${label}</td>
          <td>${va ?? "N/A"}</td>
          <td>${vb ?? "N/A"}</td>
        </tr>`;

      compareOutput.innerHTML = `
        <table class="compare-table">
          <thead>
            <tr><th></th><th>${zipA}</th><th>${zipB}</th></tr>
          </thead>
          <tbody>
            ${row("City", `${a.city}, ${a.state}`, `${b.city}, ${b.state}`)}
            ${row("Safety Score", a.safetyScore, b.safetyScore)}
            ${row("Risk Level", a.riskLevel, b.riskLevel)}
            ${row("Violent Crime", a.violentCrime?.toLocaleString(), b.violentCrime?.toLocaleString())}
            ${row("Property Crime", a.propertyCrime?.toLocaleString(), b.propertyCrime?.toLocaleString())}
            ${row("Data Year", a.dataYear, b.dataYear)}
          </tbody>
        </table>`;
    } catch (err) {
      compareOutput.innerHTML = "<p>Could not load comparison data.</p>";
    }
  });
}

// ── FOCUS / FULLSCREEN ─────────────────────────────────────────────────
if (focusBtn) {
  focusBtn.addEventListener("click", () => {
    document.body.classList.toggle("focus-mode");
    focusBtn.textContent = document.body.classList.contains("focus-mode")
      ? "Exit Focus"
      : "Focus Mode";
  });
}