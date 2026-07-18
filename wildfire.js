// ---------------------------
// Safety & Crime — wildfire.js
// Active US wildfires: NIFC WFIGS open data (ArcGIS REST, free, no key)
// Fire weather alerts: NWS API (free, no key)
// Worldwide major fires: NASA EONET (free, no key)
// ---------------------------

const FIRE_RADIUS_M = 241000; // ~150 miles

// ── DOM ────────────────────────────────────────────────────────────────
const wfZipInput  = document.getElementById("wfZipInput");
const wfSearchBtn = document.getElementById("wfSearchBtn");
const wfZipError  = document.getElementById("wfZipError");
const wfEmpty     = document.getElementById("wfEmpty");
const wfLoading   = document.getElementById("wfLoading");
const wfResults   = document.getElementById("wfResults");
const wfLocation  = document.getElementById("wfLocation");
const wfStats     = document.getElementById("wfStats");
const wfFireList  = document.getElementById("wfFireList");
const wfAlertList = document.getElementById("wfAlertList");

const NIFC_URL = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query";
const NIFC_FIELDS = "IncidentName,IncidentSize,PercentContained,FireDiscoveryDateTime,POOState,IncidentTypeCategory";

// ── ZIP → COORDS ───────────────────────────────────────────────────────
async function wfFetchZipInfo(zip) {
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

// ── NIFC QUERIES ───────────────────────────────────────────────────────
function nifcParse(json) {
  return (json?.features ?? []).map(f => ({
    name: f.attributes?.IncidentName ?? "Unnamed fire",
    acres: f.attributes?.IncidentSize ?? null,
    contained: f.attributes?.PercentContained ?? null,
    discovered: f.attributes?.FireDiscoveryDateTime ?? null,
    state: f.attributes?.POOState ?? "",
    type: f.attributes?.IncidentTypeCategory ?? "",
    lat: f.geometry?.y, lng: f.geometry?.x,
  })).filter(x => x.lat != null);
}

async function fetchFiresNear(lat, lng) {
  const p = new URLSearchParams({
    where: "1=1",
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    distance: FIRE_RADIUS_M,
    units: "esriSRUnit_Meter",
    spatialRel: "esriSpatialRelIntersects",
    outFields: NIFC_FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });
  const res = await fetch(`${NIFC_URL}?${p}`);
  if (!res.ok) return [];
  return nifcParse(await res.json());
}

async function fetchLargeFiresNational() {
  const p = new URLSearchParams({
    where: "IncidentSize > 500",
    outFields: NIFC_FIELDS,
    orderByFields: "IncidentSize DESC",
    resultRecordCount: "25",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });
  const res = await fetch(`${NIFC_URL}?${p}`);
  if (!res.ok) return [];
  return nifcParse(await res.json());
}

// ── NWS FIRE WEATHER ALERTS ────────────────────────────────────────────
async function fetchFireAlerts(lat, lng) {
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`);
    if (!res.ok) return [];
    const d = await res.json();
    return (d?.features ?? []).filter(a => {
      const ev = (a.properties?.event || "").toLowerCase();
      return ev.includes("fire") || ev.includes("red flag");
    });
  } catch (_) { return []; }
}

// ── EONET WORLDWIDE FIRES ──────────────────────────────────────────────
async function loadWorldFires() {
  const el = document.getElementById("wfWorldList");
  if (!el) return;
  try {
    const res = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=10");
    if (!res.ok) throw new Error();
    const d = await res.json();
    const events = (d?.events ?? []).slice(0, 10);
    if (events.length === 0) {
      el.innerHTML = `<div class="e-none">No major wildfire events currently tracked worldwide.</div>`;
      return;
    }
    el.innerHTML = events.map(ev => {
      const geo = ev.geometry?.[ev.geometry.length - 1];
      const when = geo?.date ? new Date(geo.date).toLocaleDateString() : "";
      return `
        <div class="e-row">
          <div class="e-mag" style="background:#ea580c;font-size:16px;min-width:48px;">🔥</div>
          <div class="e-row-body">
            <div class="e-row-place">${ev.title ?? "Wildfire event"}</div>
            <div class="e-row-meta">Last update: ${when}${ev.sources?.[0]?.url ? ` · <a href="${ev.sources[0].url}" target="_blank" rel="noopener" style="color:var(--green,#16a34a);text-decoration:none;">Source →</a>` : ""}</div>
          </div>
        </div>`;
    }).join("");

    // Plot worldwide fires on the map too (cleared on first search)
    if (wfMap) {
      events.forEach(ev => {
        const geo = ev.geometry?.[ev.geometry.length - 1];
        const coords = geo?.coordinates;
        if (!coords) return;
        const m = L.circleMarker([coords[1], coords[0]], {
          radius: 7, color: "#ea580c", weight: 1.5, fillColor: "#f97316", fillOpacity: 0.6,
        }).addTo(wfMap).bindPopup(`<strong>🔥 ${ev.title ?? "Wildfire"}</strong><br>${geo?.date ? new Date(geo.date).toLocaleDateString() : ""}`);
        wfMapLayers.push(m);
      });
    }
  } catch (_) {
    el.innerHTML = `<div class="e-none">Couldn't load the worldwide fire feed right now.</div>`;
  }
}

// ── MAP ────────────────────────────────────────────────────────────────
let wfMap = null;
let wfMapLayers = [];
let wfMapClickBound = false;

async function wfReverseGeocodeZip(lat, lng) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.countryCode !== "US") return null;
    const zip = (d?.postcode || "").substring(0, 5);
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch (_) { return null; }
}

function initFireMapBase() {
  const mapEl = document.getElementById("wfMap");
  if (wfMap || !mapEl || typeof L === "undefined") return;

  wfMap = L.map("wfMap").setView([39.5, -98.35], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors · Fires: NIFC / NASA EONET",
  }).addTo(wfMap);

  if (!wfMapClickBound) {
    wfMapClickBound = true;
    wfMap.on("click", async (e) => {
      const zip = await wfReverseGeocodeZip(e.latlng.lat, e.latlng.lng);
      if (zip) {
        if (wfZipInput) wfZipInput.value = zip;
        searchFires(zip);
      } else if (wfZipError) {
        wfZipError.textContent = "Couldn't find a ZIP code at that spot — try clicking closer to a populated area.";
        wfZipError.classList.remove("hidden");
        setTimeout(() => wfZipError.classList.add("hidden"), 4000);
      }
    });
  }
}

function fireSizeLabel(acres) {
  if (acres == null) return "Size unknown";
  if (acres < 100) return "Small";
  if (acres < 1000) return "Notable";
  if (acres < 10000) return "Large";
  if (acres < 100000) return "Very large";
  return "Megafire";
}

function fireColor(acres) {
  if (acres == null) return "#9ca3af";
  if (acres < 100) return "#d97706";
  if (acres < 10000) return "#ea580c";
  return "#dc2626";
}

function plotFires(fires, centerLat, centerLng, zoomTo) {
  initFireMapBase();
  if (!wfMap) return;

  wfMapLayers.forEach(l => wfMap.removeLayer(l));
  wfMapLayers = [];

  if (centerLat != null) {
    const home = L.marker([centerLat, centerLng]).addTo(wfMap).bindPopup("Searched location");
    wfMapLayers.push(home);
    const radius = L.circle([centerLat, centerLng], { radius: FIRE_RADIUS_M, color: "#ea580c", weight: 1, fillOpacity: 0.03 });
    radius.addTo(wfMap);
    wfMapLayers.push(radius);
    if (zoomTo) wfMap.setView([centerLat, centerLng], 7);
  }

  fires.forEach(f => {
    const m = L.circleMarker([f.lat, f.lng], {
      radius: Math.max(6, Math.min(18, Math.log10((f.acres ?? 10) + 10) * 4)),
      color: fireColor(f.acres), weight: 1.5, fillColor: fireColor(f.acres), fillOpacity: 0.55,
    }).addTo(wfMap).bindPopup(
      `<strong>🔥 ${f.name}</strong><br>` +
      `${f.acres != null ? f.acres.toLocaleString() + " acres · " : ""}${f.contained != null ? f.contained + "% contained" : "Containment unknown"}<br>` +
      `${f.discovered ? "Discovered " + new Date(f.discovered).toLocaleDateString() : ""}`
    );
    wfMapLayers.push(m);
  });
}

// ── RENDER ─────────────────────────────────────────────────────────────
function renderFires(zip, loc, fires, alerts) {
  if (wfLocation) wfLocation.textContent = `${loc.city}, ${loc.state} — ${zip} · active fires within ~150 miles`;

  const totalAcres = fires.reduce((a, f) => a + (f.acres ?? 0), 0);
  const largest = fires.length ? fires.reduce((a, b) => ((a.acres ?? 0) > (b.acres ?? 0) ? a : b)) : null;

  if (wfStats) {
    wfStats.innerHTML = `
      <div class="e-stat">
        <div class="e-stat-label">Active Fires Nearby</div>
        <div class="e-stat-value" style="color:${fires.length > 0 ? "#ea580c" : "#16a34a"};">${fires.length}</div>
        <div class="e-stat-sub">within ~150 miles right now</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Largest Nearby</div>
        <div class="e-stat-value" style="color:${largest ? fireColor(largest.acres) : "#16a34a"};font-size:20px;">${largest ? (largest.acres != null ? largest.acres.toLocaleString() + " ac" : largest.name) : "—"}</div>
        <div class="e-stat-sub">${largest ? largest.name : "no active fires nearby"}</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Fire Weather Alerts</div>
        <div class="e-stat-value" style="color:${alerts.length > 0 ? "#dc2626" : "#16a34a"};">${alerts.length}</div>
        <div class="e-stat-sub">${alerts.length > 0 ? "active for this location" : "none for this location"}</div>
      </div>
    `;
  }

  if (wfAlertList) {
    if (alerts.length === 0) {
      wfAlertList.innerHTML = `<div class="e-none">No Red Flag Warnings or fire weather alerts for this location right now.</div>`;
    } else {
      wfAlertList.innerHTML = alerts.map(a => {
        const p = a.properties ?? {};
        return `
          <div class="e-row" style="border-left:3px solid #dc2626;">
            <div class="e-mag" style="background:#dc2626;font-size:11px;min-width:70px;">${p.severity ?? "Alert"}</div>
            <div class="e-row-body">
              <div class="e-row-place">${p.event ?? "Fire Weather Alert"}</div>
              <div class="e-row-meta">${p.headline ?? ""}</div>
              <div class="e-row-meta">Expires: ${p.expires ? new Date(p.expires).toLocaleString() : "—"}</div>
            </div>
          </div>`;
      }).join("");
    }
  }

  if (wfFireList) {
    if (fires.length === 0) {
      wfFireList.innerHTML = `<div class="e-none">No active wildland fires recorded within ~150 miles. That's good news!</div>`;
    } else {
      const sorted = [...fires].sort((a, b) => (b.acres ?? 0) - (a.acres ?? 0));
      wfFireList.innerHTML = sorted.slice(0, 15).map(f => `
        <div class="e-row">
          <div class="e-mag" style="background:${fireColor(f.acres)};font-size:11px;min-width:70px;line-height:1.3;">${f.acres != null ? f.acres.toLocaleString() + " ac" : "🔥"}</div>
          <div class="e-row-body">
            <div class="e-row-place">${f.name}${f.state ? " — " + f.state.replace("US-", "") : ""}${f.type === "RX" ? " <span style='font-size:11px;color:#a855f7;font-weight:600;'>(prescribed burn)</span>" : ""}</div>
            <div class="e-row-meta">${fireSizeLabel(f.acres)}${f.contained != null ? ` · ${f.contained}% contained` : ""}${f.discovered ? ` · Discovered ${new Date(f.discovered).toLocaleDateString()}` : ""}</div>
          </div>
        </div>`).join("");
      if (fires.length > 15) {
        wfFireList.innerHTML += `<div class="e-more">+ ${fires.length - 15} more (all shown on the map)</div>`;
      }
    }
  }

  if (wfEmpty)   wfEmpty.style.display = "none";
  if (wfLoading) wfLoading.style.display = "none";
  if (wfResults) wfResults.style.display = "block";
  const listsSection = document.getElementById("wfListsSection");
  if (listsSection) listsSection.style.display = "block";
  const worldSection = document.getElementById("wfWorldSection");
  if (worldSection) worldSection.style.display = "none";
  const natSection = document.getElementById("wfNationalSection");
  if (natSection) natSection.style.display = "none";

  setTimeout(() => {
    plotFires(fires, loc.lat, loc.lng, true);
    if (wfMap) wfMap.invalidateSize();
  }, 100);
}

function showFireError(msg) {
  if (wfLoading) wfLoading.style.display = "none";
  if (wfResults) wfResults.style.display = "none";
  if (wfEmpty) { wfEmpty.style.display = "block"; wfEmpty.textContent = msg; }
}

// ── NATIONAL LARGE FIRES (loads on page open) ──────────────────────────
async function loadNationalFires() {
  const el = document.getElementById("wfNationalList");
  if (!el) return;
  try {
    const fires = await fetchLargeFiresNational();
    if (fires.length === 0) {
      el.innerHTML = `<div class="e-none">No large active wildland fires (500+ acres) in the U.S. right now.</div>`;
      return;
    }
    el.innerHTML = fires.slice(0, 10).map(f => `
      <div class="e-row">
        <div class="e-mag" style="background:${fireColor(f.acres)};font-size:11px;min-width:70px;line-height:1.3;">${f.acres != null ? f.acres.toLocaleString() + " ac" : "🔥"}</div>
        <div class="e-row-body">
          <div class="e-row-place">${f.name}${f.state ? " — " + f.state.replace("US-", "") : ""}</div>
          <div class="e-row-meta">${fireSizeLabel(f.acres)}${f.contained != null ? ` · ${f.contained}% contained` : ""}${f.discovered ? ` · Discovered ${new Date(f.discovered).toLocaleDateString()}` : ""}</div>
        </div>
      </div>`).join("");

    plotFires(fires, null, null, false);
  } catch (_) {
    el.innerHTML = `<div class="e-none">Couldn't load the national fire feed right now.</div>`;
  }
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchFires(zip) {
  let q = (zip || wfZipInput?.value.trim() || "").toString();
  if (!/^\d{5}$/.test(q) && typeof geoResolveToZip === "function") {
    const resolved = await geoResolveToZip(q);
    if (resolved?.zip) { q = resolved.zip; if (wfZipInput) wfZipInput.value = q; }
  }
  zip = q;
  if (!/^\d{5}$/.test(zip)) {
    if (wfZipError) { wfZipError.textContent = "Enter a 5-digit ZIP code or a city name (e.g. Houston, TX)."; wfZipError.classList.remove("hidden"); }
    return;
  }
  if (wfZipError) { wfZipError.textContent = ""; wfZipError.classList.add("hidden"); }

  if (wfEmpty)   wfEmpty.style.display = "none";
  if (wfResults) wfResults.style.display = "none";
  if (wfLoading) wfLoading.style.display = "block";

  try {
    const loc = await wfFetchZipInfo(zip);
    if (!loc || !Number.isFinite(loc.lat)) {
      showFireError("We couldn't find that ZIP code. Double-check it and try again.");
      return;
    }

    const [fires, alerts] = await Promise.all([
      fetchFiresNear(loc.lat, loc.lng),
      fetchFireAlerts(loc.lat, loc.lng),
    ]);

    renderFires(zip, loc, fires, alerts);

    const url = new URL(window.location);
    url.searchParams.set("zip", zip);
    window.history.replaceState({}, "", url);
  } catch (_) {
    showFireError("Something went wrong fetching wildfire data. Please try again.");
  }
}

// ── EVENTS ─────────────────────────────────────────────────────────────
wfSearchBtn?.addEventListener("click", () => searchFires());
wfZipInput?.addEventListener("keydown", e => { if (e.key === "Enter") searchFires(); });

window.addEventListener("load", () => {
  initFireMapBase();
  setTimeout(() => wfMap?.invalidateSize(), 200);
  loadNationalFires();
  loadWorldFires();
  const params = new URLSearchParams(window.location.search);
  const zipParam = params.get("zip");
  if (zipParam && /^\d{5}$/.test(zipParam)) {
    if (wfZipInput) wfZipInput.value = zipParam;
    searchFires(zipParam);
  }
});