// ---------------------------
// Safety & Crime — earthquake.js
// ZIP → lat/lng (Zippopotam) → USGS earthquake data (no key required)
// Recent quakes (past 30 days) + historical significant quakes (past 50 years)
// within ~100 miles of the searched ZIP, plotted on a Leaflet map.
// ---------------------------

const RADIUS_KM = 161; // ~100 miles

// ── DOM ────────────────────────────────────────────────────────────────
const eZipInput  = document.getElementById("eZipInput");
const eSearchBtn = document.getElementById("eSearchBtn");
const eZipError  = document.getElementById("eZipError");
const eEmpty     = document.getElementById("eEmpty");
const eLoading   = document.getElementById("eLoading");
const eResults   = document.getElementById("eResults");
const eLocation  = document.getElementById("eLocation");
const eStats     = document.getElementById("eStats");
const eList      = document.getElementById("eList");
const eHistList  = document.getElementById("eHistList");

// ── ZIP → COORDS ───────────────────────────────────────────────────────
async function eFetchZipInfo(zip) {
  const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!r.ok) return null;
  const d = await r.json();
  const place = d?.places?.[0];
  if (!place) return null;
  return {
    city:  place["place name"] ?? "Unknown",
    state: place["state abbreviation"] ?? "",
    lat:   parseFloat(place["latitude"]),
    lng:   parseFloat(place["longitude"]),
  };
}

// ── USGS QUERIES ───────────────────────────────────────────────────────
function usgsUrl(lat, lng, { starttime, minmagnitude, limit }) {
  const p = new URLSearchParams({
    format: "geojson",
    latitude: lat,
    longitude: lng,
    maxradiuskm: RADIUS_KM,
    orderby: "time",
    limit: limit || 200,
  });
  if (starttime) p.set("starttime", starttime);
  if (minmagnitude != null) p.set("minmagnitude", minmagnitude);
  return `https://earthquake.usgs.gov/fdsnws/event/1/query?${p.toString()}`;
}

async function fetchQuakes(lat, lng) {
  const now = new Date();
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
  const y50 = new Date(now); y50.setFullYear(y50.getFullYear() - 50);

  const [recentRes, histRes] = await Promise.all([
    fetch(usgsUrl(lat, lng, { starttime: d30.toISOString(), limit: 200 })),
    fetch(usgsUrl(lat, lng, { starttime: y50.toISOString(), minmagnitude: 4, limit: 20 })),
  ]);

  const recent = recentRes.ok ? (await recentRes.json())?.features ?? [] : [];
  const historical = histRes.ok ? (await histRes.json())?.features ?? [] : [];
  return { recent, historical };
}

// ── HELPERS ────────────────────────────────────────────────────────────
function magColor(mag) {
  if (mag == null) return "#9ca3af";
  if (mag < 2)  return "#16a34a";
  if (mag < 3)  return "#84cc16";
  if (mag < 4)  return "#d97706";
  if (mag < 5)  return "#ea580c";
  if (mag < 6)  return "#dc2626";
  return "#7f1d1d";
}

function magLabel(mag) {
  if (mag == null) return "Unknown";
  if (mag < 2)  return "Micro — rarely felt";
  if (mag < 3)  return "Minor — often unfelt";
  if (mag < 4)  return "Light — felt by many";
  if (mag < 5)  return "Moderate — can cause damage";
  if (mag < 6)  return "Strong — damaging";
  return "Major — serious damage possible";
}

function kmToMi(km) { return km * 0.621371; }

// Distance between two coords (Haversine, miles)
function distMi(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function riskAssessment(recent, historical) {
  const hist5 = historical.filter(q => (q.properties?.mag ?? 0) >= 5).length;
  const recentCount = recent.length;
  if (hist5 >= 3 || recentCount >= 50) return { level: "Elevated", color: "#dc2626", note: "This area has notable seismic activity. Consider earthquake insurance and home retrofitting if you live here." };
  if (hist5 >= 1 || recentCount >= 10) return { level: "Moderate", color: "#d97706", note: "Some seismic activity occurs in this region. Significant quakes are possible but historically infrequent." };
  return { level: "Low", color: "#16a34a", note: "This area sees little recorded seismic activity. Damaging earthquakes are historically rare here." };
}

// ── MAP ────────────────────────────────────────────────────────────────
// Reverse geocode a clicked point → nearest ZIP (same source as the crime tool)
async function eReverseGeocodeZip(lat, lng) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.countryCode !== "US") return null;
    const zip = (d?.postcode || "").substring(0, 5);
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch (_) { return null; }
}

let eMap = null;
let eMapLayers = [];
let eMapClickBound = false;

function initQuakeMapBase() {
  const mapEl = document.getElementById("eMap");
  if (eMap || !mapEl || typeof L === "undefined") return;

  eMap = L.map("eMap").setView([39.5, -98.35], 4); // national view until a search
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors · Quakes: USGS",
  }).addTo(eMap);

  if (!eMapClickBound) {
    eMapClickBound = true;
    eMap.on("click", async (e) => {
      const zip = await eReverseGeocodeZip(e.latlng.lat, e.latlng.lng);
      if (zip) {
        if (eZipInput) eZipInput.value = zip;
        searchQuakes(zip);
      } else if (eZipError) {
        eZipError.textContent = "Couldn't find a ZIP code at that spot — try clicking closer to a populated area.";
        eZipError.classList.remove("hidden");
        setTimeout(() => eZipError.classList.add("hidden"), 4000);
      }
    });
  }
}

function renderQuakeMap(lat, lng, recent, historical) {
  initQuakeMapBase();
  if (!eMap) return;
  eMap.setView([lat, lng], 8);

  // Clear previous layers
  eMapLayers.forEach(l => eMap.removeLayer(l));
  eMapLayers = [];

  // Searched location marker
  const home = L.marker([lat, lng]).addTo(eMap).bindPopup("Searched location");
  eMapLayers.push(home);

  // Radius circle (~100 miles)
  const radius = L.circle([lat, lng], { radius: RADIUS_KM * 1000, color: "#16a34a", weight: 1, fillOpacity: 0.03 }).addTo(eMap);
  eMapLayers.push(radius);

  // Historical significant quakes (subtle rings)
  historical.forEach(q => {
    const [qlng, qlat] = q.geometry?.coordinates ?? [];
    const mag = q.properties?.mag;
    if (qlat == null || qlng == null) return;
    const c = L.circleMarker([qlat, qlng], {
      radius: Math.max(6, (mag ?? 3) * 2.4),
      color: magColor(mag), weight: 1.5, fillOpacity: 0.08, dashArray: "3,3",
    }).addTo(eMap).bindPopup(
      `<strong>M${mag?.toFixed(1) ?? "?"}</strong> (historical) — ${q.properties?.place ?? ""}<br>${new Date(q.properties?.time).toLocaleDateString()}`
    );
    eMapLayers.push(c);
  });

  // Recent quakes (solid dots)
  recent.forEach(q => {
    const [qlng, qlat] = q.geometry?.coordinates ?? [];
    const mag = q.properties?.mag;
    if (qlat == null || qlng == null) return;
    const c = L.circleMarker([qlat, qlng], {
      radius: Math.max(5, (mag ?? 1) * 2.8),
      color: magColor(mag), weight: 1, fillColor: magColor(mag), fillOpacity: 0.55,
    }).addTo(eMap).bindPopup(
      `<strong>M${mag?.toFixed(1) ?? "?"}</strong> — ${q.properties?.place ?? ""}<br>${new Date(q.properties?.time).toLocaleString()}`
    );
    eMapLayers.push(c);
  });
}

// ── RENDER ─────────────────────────────────────────────────────────────
function renderQuakes(zip, loc, data) {
  const { recent, historical } = data;

  if (eLocation) eLocation.textContent = `${loc.city}, ${loc.state} — ${zip} · quakes within ~100 miles`;

  const mags = recent.map(q => q.properties?.mag).filter(m => m != null);
  const largest = mags.length ? Math.max(...mags) : null;
  const risk = riskAssessment(recent, historical);

  if (eStats) {
    eStats.innerHTML = `
      <div class="e-stat">
        <div class="e-stat-label">Past 30 Days</div>
        <div class="e-stat-value">${recent.length}</div>
        <div class="e-stat-sub">recorded quakes nearby</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Largest Recent</div>
        <div class="e-stat-value" style="color:${magColor(largest)};">${largest != null ? "M" + largest.toFixed(1) : "—"}</div>
        <div class="e-stat-sub">${largest != null ? magLabel(largest) : "none in past 30 days"}</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Seismic Risk</div>
        <div class="e-stat-value" style="color:${risk.color};">${risk.level}</div>
        <div class="e-stat-sub">${historical.length} significant quakes (M4+) in past 50 yrs</div>
      </div>
    `;
  }

  const riskNote = document.getElementById("eRiskNote");
  if (riskNote) riskNote.textContent = risk.note;

  if (eList) {
    if (recent.length === 0) {
      eList.innerHTML = `<div class="e-none">No earthquakes recorded within ~100 miles in the past 30 days. That's good news!</div>`;
      // Give the user something concrete to look at: the nearest quake anywhere
      fetchNearestQuake(loc.lat, loc.lng).then(nearest => {
        if (nearest) renderNearestQuakeCard(eList, nearest);
      });
    } else {
      eList.innerHTML = recent.slice(0, 15).map(q => {
        const mag = q.properties?.mag;
        const [qlng, qlat] = q.geometry?.coordinates ?? [];
        const dist = (qlat != null) ? distMi(loc.lat, loc.lng, qlat, qlng) : null;
        return `
          <div class="e-row">
            <div class="e-mag" style="background:${magColor(mag)};">M${mag?.toFixed(1) ?? "?"}</div>
            <div class="e-row-body">
              <div class="e-row-place">${q.properties?.place ?? "Unknown location"}</div>
              <div class="e-row-meta">${new Date(q.properties?.time).toLocaleString()}${dist != null ? ` · ${dist.toFixed(0)} mi away` : ""} · Depth ${q.geometry?.coordinates?.[2]?.toFixed(0) ?? "?"} km</div>
            </div>
          </div>`;
      }).join("");
      if (recent.length > 15) {
        eList.innerHTML += `<div class="e-more">+ ${recent.length - 15} more in the past 30 days (all shown on the map)</div>`;
      }
    }
  }

  if (eHistList) {
    if (historical.length === 0) {
      eHistList.innerHTML = `<div class="e-none">No significant (M4+) earthquakes recorded within ~100 miles in the past 50 years.</div>`;
    } else {
      const sorted = [...historical].sort((a, b) => (b.properties?.mag ?? 0) - (a.properties?.mag ?? 0));
      eHistList.innerHTML = sorted.slice(0, 8).map(q => {
        const mag = q.properties?.mag;
        return `
          <div class="e-row">
            <div class="e-mag" style="background:${magColor(mag)};">M${mag?.toFixed(1) ?? "?"}</div>
            <div class="e-row-body">
              <div class="e-row-place">${q.properties?.place ?? "Unknown location"}</div>
              <div class="e-row-meta">${new Date(q.properties?.time).toLocaleDateString()} · ${magLabel(mag)}</div>
            </div>
          </div>`;
      }).join("");
    }
  }

  if (eEmpty)   eEmpty.style.display = "none";
  if (eLoading) eLoading.style.display = "none";
  if (eResults) eResults.style.display = "block";
  const resultsTop = document.getElementById("eResultsTop");
  if (resultsTop) resultsTop.style.display = "block";
  const latestSection = document.getElementById("eLatestSection");
  if (latestSection) latestSection.style.display = "none";

  setTimeout(() => {
    renderQuakeMap(loc.lat, loc.lng, recent, historical);
    if (eMap) eMap.invalidateSize();
  }, 100);
}

function showQuakeError(msg) {
  if (eLoading) eLoading.style.display = "none";
  if (eResults) eResults.style.display = "none";
  const resultsTop = document.getElementById("eResultsTop");
  if (resultsTop) resultsTop.style.display = "none";
  if (eEmpty) { eEmpty.style.display = "block"; eEmpty.textContent = msg; }
}

// When an area has no recent quakes, find the nearest one by progressively
// widening the radius, so users always have something concrete to look at.
async function fetchNearestQuake(lat, lng) {
  const d90 = new Date(); d90.setDate(d90.getDate() - 90);
  const radii = [400, 800, 1600, 3200]; // km, ~250 → ~2000 miles
  for (const r of radii) {
    try {
      const p = new URLSearchParams({
        format: "geojson", latitude: lat, longitude: lng,
        maxradiuskm: r, starttime: d90.toISOString(),
        minmagnitude: 2, limit: 300, orderby: "time",
      });
      const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${p}`);
      if (!res.ok) continue;
      const feats = (await res.json())?.features ?? [];
      if (feats.length === 0) continue;
      // Pick the geographically closest, not the most recent
      let best = null, bestDist = Infinity;
      feats.forEach(q => {
        const [qlng, qlat] = q.geometry?.coordinates ?? [];
        if (qlat == null) return;
        const d = distMi(lat, lng, qlat, qlng);
        if (d < bestDist) { bestDist = d; best = q; }
      });
      if (best) return { quake: best, distMi: bestDist };
    } catch (_) { /* try next radius */ }
  }
  return null;
}

function renderNearestQuakeCard(container, nearest) {
  if (!container || !nearest) return;
  const q = nearest.quake;
  const p = q.properties ?? {};
  const mag = p.mag;
  const depth = q.geometry?.coordinates?.[2];
  container.innerHTML += `
    <div class="e-section-title" style="margin-top:16px;">📍 Nearest Recent Earthquake</div>
    <div class="e-row" style="border-left:3px solid ${magColor(mag)};">
      <div class="e-mag" style="background:${magColor(mag)};">M${mag?.toFixed(1) ?? "?"}</div>
      <div class="e-row-body">
        <div class="e-row-place">${p.place ?? "Unknown location"}</div>
        <div class="e-row-meta">${new Date(p.time).toLocaleString()} · ~${nearest.distMi.toFixed(0)} mi from your searched location · Depth ${depth != null ? depth.toFixed(0) + " km" : "?"}</div>
        <div class="e-row-meta">${magLabel(mag)}${p.url ? ` · <a href="${p.url}" target="_blank" rel="noopener" style="color:var(--green,#16a34a);text-decoration:none;">Full USGS report →</a>` : ""}</div>
      </div>
    </div>`;
}

// ── LATEST SIGNIFICANT QUAKES (worldwide feed, loads on page open) ─────
async function loadLatestQuakes() {
  const el = document.getElementById("eLatest");
  if (!el) return;
  try {
    // M4.5+ worldwide over the past week — reliably has fresh entries
    const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson");
    if (!res.ok) throw new Error();
    const data = await res.json();
    const quakes = (data?.features ?? []).slice(0, 10);
    if (quakes.length === 0) {
      el.innerHTML = `<div class="e-none">No significant earthquakes recorded this week.</div>`;
      return;
    }

    // Plot feed quakes on the national map (cleared automatically on first ZIP search)
    if (eMap) {
      quakes.forEach(q => {
        const [qlng, qlat] = q.geometry?.coordinates ?? [];
        const mag = q.properties?.mag;
        if (qlat == null) return;
        const c = L.circleMarker([qlat, qlng], {
          radius: Math.max(5, (mag ?? 3) * 2.2),
          color: magColor(mag), weight: 1, fillColor: magColor(mag), fillOpacity: 0.55,
        }).addTo(eMap).bindPopup(
          `<strong>M${mag?.toFixed(1) ?? "?"}</strong> — ${q.properties?.place ?? ""}<br>${new Date(q.properties?.time).toLocaleString()}`
        );
        eMapLayers.push(c);
      });
    }

    el.innerHTML = quakes.map(q => {
      const p = q.properties ?? {};
      const mag = p.mag;
      const depth = q.geometry?.coordinates?.[2];
      const alertColors = { green: "#16a34a", yellow: "#d97706", orange: "#ea580c", red: "#dc2626" };
      const extras = [
        `Depth ${depth != null ? depth.toFixed(0) + " km" : "?"}`,
        p.felt ? `👥 ${p.felt.toLocaleString()} felt reports` : null,
        p.tsunami === 1 ? `🌊 Tsunami advisory issued` : null,
        p.alert ? `<span style="color:${alertColors[p.alert] || "#6b7280"};font-weight:600;">PAGER: ${p.alert.toUpperCase()}</span>` : null,
      ].filter(Boolean).join(" · ");
      return `
        <div class="e-row">
          <div class="e-mag" style="background:${magColor(mag)};">M${mag?.toFixed(1) ?? "?"}</div>
          <div class="e-row-body">
            <div class="e-row-place">${p.place ?? "Unknown location"}</div>
            <div class="e-row-meta">${new Date(p.time).toLocaleString()} · ${extras}</div>
            ${p.url ? `<div class="e-row-meta"><a href="${p.url}" target="_blank" rel="noopener" style="color:var(--green,#16a34a);text-decoration:none;">Full USGS report →</a></div>` : ""}
          </div>
        </div>`;
    }).join("");
  } catch (_) {
    el.innerHTML = `<div class="e-none">Couldn't load the latest earthquake feed right now.</div>`;
  }
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchQuakes(zip) {
  zip = (zip || eZipInput?.value.trim() || "").toString();
  if (!/^\d{5}$/.test(zip)) {
    if (eZipError) { eZipError.textContent = "Please enter a valid 5-digit ZIP code."; eZipError.classList.remove("hidden"); }
    return;
  }
  if (eZipError) { eZipError.textContent = ""; eZipError.classList.add("hidden"); }

  if (eEmpty)   eEmpty.style.display = "none";
  if (eResults) eResults.style.display = "none";
  if (eLoading) eLoading.style.display = "block";

  try {
    const loc = await eFetchZipInfo(zip);
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
      showQuakeError("We couldn't find that ZIP code. Double-check it and try again.");
      return;
    }

    const data = await fetchQuakes(loc.lat, loc.lng);
    renderQuakes(zip, loc, data);

    const url = new URL(window.location);
    url.searchParams.set("zip", zip);
    window.history.replaceState({}, "", url);
  } catch (_) {
    showQuakeError("Something went wrong fetching earthquake data. Please try again.");
  }
}

// ── EVENTS ─────────────────────────────────────────────────────────────
eSearchBtn?.addEventListener("click", () => searchQuakes());
eZipInput?.addEventListener("keydown", e => { if (e.key === "Enter") searchQuakes(); });

window.addEventListener("load", () => {
  initQuakeMapBase();
  setTimeout(() => eMap?.invalidateSize(), 200);
  loadLatestQuakes();
  const params = new URLSearchParams(window.location.search);
  const zipParam = params.get("zip");
  if (zipParam && /^\d{5}$/.test(zipParam)) {
    if (eZipInput) eZipInput.value = zipParam;
    searchQuakes(zipParam);
  }
});