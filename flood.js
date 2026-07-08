// ---------------------------
// Safety & Crime — flood.js
// ZIP → lat/lng (Zippopotam) → FEMA flood zone + NWS flood alerts +
// USGS stream gauges (all free, no keys required)
// ---------------------------

// ── DOM ────────────────────────────────────────────────────────────────
const fZipInput  = document.getElementById("fZipInput");
const fSearchBtn = document.getElementById("fSearchBtn");
const fZipError  = document.getElementById("fZipError");
const fEmpty     = document.getElementById("fEmpty");
const fLoading   = document.getElementById("fLoading");
const fResults   = document.getElementById("fResults");
const fLocation  = document.getElementById("fLocation");
const fStats     = document.getElementById("fStats");
const fAlertList = document.getElementById("fAlertList");
const fGaugeList = document.getElementById("fGaugeList");

// ── ZIP → COORDS ───────────────────────────────────────────────────────
async function fFetchZipInfo(zip) {
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

// ── FEMA FLOOD ZONE (NFHL point query) ────────────────────────────────
async function fetchFloodZone(lat, lng) {
  try {
    const p = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "FLD_ZONE,ZONE_SUBTY",
      returnGeometry: "false",
      f: "json",
    });
    const res = await fetch(`https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?${p}`);
    if (!res.ok) return null;
    const d = await res.json();
    const attr = d?.features?.[0]?.attributes;
    if (!attr) return null;
    return { zone: attr.FLD_ZONE || null, subtype: attr.ZONE_SUBTY || null };
  } catch (_) { return null; }
}

function zoneInfo(zone, subtype) {
  if (!zone) return { label: "Unavailable", color: "#9ca3af", risk: "Unknown", note: "FEMA flood zone data isn't available for this exact point. Check FEMA's Flood Map Service Center for official determinations." };
  const z = zone.toUpperCase();
  if (z === "AE" || z === "A" || z === "AH" || z === "AO" || z === "VE" || z === "V")
    return { label: `Zone ${z}`, color: "#dc2626", risk: "High",
      note: `Zone ${z} is a FEMA Special Flood Hazard Area — a 1% or greater annual chance of flooding (the "100-year floodplain"). Flood insurance is federally required for mortgaged properties here.` };
  if (z === "X" && subtype && subtype.toUpperCase().includes("0.2"))
    return { label: "Zone X (shaded)", color: "#d97706", risk: "Moderate",
      note: "Shaded Zone X means a 0.2% annual chance of flooding (the \"500-year floodplain\"). Flood insurance isn't required but is often recommended — many flood claims come from moderate-risk zones." };
  if (z === "X")
    return { label: "Zone X", color: "#16a34a", risk: "Minimal",
      note: "Zone X (unshaded) is outside FEMA's mapped high-risk flood areas. Flooding is still possible — especially from intense local rainfall — but insurance isn't federally required." };
  if (z === "D")
    return { label: "Zone D", color: "#9ca3af", risk: "Undetermined",
      note: "Zone D means flood risk hasn't been formally studied for this area. Absence of mapping is not absence of risk." };
  return { label: `Zone ${z}`, color: "#d97706", risk: "Varies",
    note: `This point falls in FEMA Zone ${z}${subtype ? ` (${subtype})` : ""}. Check FEMA's Flood Map Service Center for the official determination.` };
}

// ── NWS FLOOD ALERTS (active, for the searched point) ─────────────────
const FLOOD_EVENTS = ["Flood Warning", "Flash Flood Warning", "Flash Flood Watch", "Flood Watch", "Flood Advisory", "Coastal Flood Warning", "Coastal Flood Watch", "Coastal Flood Advisory", "River Flood Warning"];

async function fetchFloodAlerts(lat, lng) {
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`);
    if (!res.ok) return [];
    const d = await res.json();
    return (d?.features ?? []).filter(a => FLOOD_EVENTS.some(ev => (a.properties?.event || "").includes(ev.split(" ")[0]) && (a.properties?.event || "").toLowerCase().includes("flood")));
  } catch (_) { return []; }
}

// ── USGS STREAM GAUGES (near the point) ────────────────────────────────
async function fetchGauges(lat, lng) {
  try {
    const w = (lng - 0.5).toFixed(4), s = (lat - 0.5).toFixed(4);
    const e = (lng + 0.5).toFixed(4), n = (lat + 0.5).toFixed(4);
    const res = await fetch(
      `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${w},${s},${e},${n}&parameterCd=00065&siteStatus=active`
    );
    if (!res.ok) return [];
    const d = await res.json();
    const series = d?.value?.timeSeries ?? [];
    return series.map(ts => {
      const site = ts.sourceInfo;
      const val = ts.values?.[0]?.value?.[0];
      return {
        name: site?.siteName ?? "Unknown gauge",
        lat: site?.geoLocation?.geogLocation?.latitude,
        lng: site?.geoLocation?.geogLocation?.longitude,
        gaugeHeight: val?.value != null ? parseFloat(val.value) : null,
        time: val?.dateTime ?? null,
        siteCode: site?.siteCode?.[0]?.value ?? null,
      };
    }).filter(g => g.lat != null && Number.isFinite(g.gaugeHeight));
  } catch (_) { return []; }
}

// ── MAP ────────────────────────────────────────────────────────────────
let fMap = null;
let fMapLayers = [];
let fMapClickBound = false;

async function fReverseGeocodeZip(lat, lng) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.countryCode !== "US") return null;
    const zip = (d?.postcode || "").substring(0, 5);
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch (_) { return null; }
}

function renderFloodMap(lat, lng, gauges) {
  const mapEl = document.getElementById("fMap");
  if (!mapEl || typeof L === "undefined") return;

  if (!fMap) {
    fMap = L.map("fMap").setView([lat, lng], 9);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors · Gauges: USGS",
    }).addTo(fMap);
  } else {
    fMap.setView([lat, lng], 9);
  }

  if (!fMapClickBound) {
    fMapClickBound = true;
    fMap.on("click", async (e) => {
      const zip = await fReverseGeocodeZip(e.latlng.lat, e.latlng.lng);
      if (zip) {
        if (fZipInput) fZipInput.value = zip;
        searchFlood(zip);
      } else if (fZipError) {
        fZipError.textContent = "Couldn't find a ZIP code at that spot — try clicking closer to a populated area.";
        fZipError.classList.remove("hidden");
        setTimeout(() => fZipError.classList.add("hidden"), 4000);
      }
    });
  }

  fMapLayers.forEach(l => fMap.removeLayer(l));
  fMapLayers = [];

  const home = L.marker([lat, lng]).addTo(fMap).bindPopup("Searched location");
  fMapLayers.push(home);

  gauges.forEach(g => {
    const c = L.circleMarker([g.lat, g.lng], {
      radius: 7, color: "#2563eb", weight: 1.5, fillColor: "#3b82f6", fillOpacity: 0.6,
    }).addTo(fMap).bindPopup(
      `<strong>💧 ${g.name}</strong><br>Gauge height: ${g.gaugeHeight} ft<br>${g.time ? new Date(g.time).toLocaleString() : ""}` +
      (g.siteCode ? `<br><a href="https://waterdata.usgs.gov/monitoring-location/${g.siteCode}/" target="_blank" rel="noopener">USGS gauge page →</a>` : "")
    );
    fMapLayers.push(c);
  });
}

// ── RENDER ─────────────────────────────────────────────────────────────
function renderFlood(zip, loc, zone, alerts, gauges) {
  if (fLocation) fLocation.textContent = `${loc.city}, ${loc.state} — ${zip}`;

  const zi = zoneInfo(zone?.zone, zone?.subtype);

  if (fStats) {
    fStats.innerHTML = `
      <div class="e-stat">
        <div class="e-stat-label">FEMA Flood Zone</div>
        <div class="e-stat-value" style="color:${zi.color};font-size:22px;">${zi.label}</div>
        <div class="e-stat-sub">${zi.risk} risk designation</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Active Flood Alerts</div>
        <div class="e-stat-value" style="color:${alerts.length > 0 ? "#dc2626" : "#16a34a"};">${alerts.length}</div>
        <div class="e-stat-sub">${alerts.length > 0 ? "affecting this location now" : "none for this location"}</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Stream Gauges Nearby</div>
        <div class="e-stat-value" style="color:#2563eb;">${gauges.length}</div>
        <div class="e-stat-sub">live USGS water monitors within ~35 mi</div>
      </div>
    `;
  }

  const riskNote = document.getElementById("fRiskNote");
  if (riskNote) riskNote.textContent = zi.note;

  if (fAlertList) {
    if (alerts.length === 0) {
      fAlertList.innerHTML = `<div class="e-none">No active flood warnings, watches, or advisories for this location right now.</div>`;
    } else {
      const sevColor = { Extreme: "#7f1d1d", Severe: "#dc2626", Moderate: "#d97706", Minor: "#16a34a" };
      fAlertList.innerHTML = alerts.map(a => {
        const p = a.properties ?? {};
        return `
          <div class="e-row" style="border-left:3px solid ${sevColor[p.severity] || "#d97706"};">
            <div class="e-mag" style="background:${sevColor[p.severity] || "#d97706"};font-size:11px;min-width:70px;">${p.severity ?? "Alert"}</div>
            <div class="e-row-body">
              <div class="e-row-place">${p.event ?? "Flood Alert"}</div>
              <div class="e-row-meta">${p.headline ?? ""}</div>
              <div class="e-row-meta">Expires: ${p.expires ? new Date(p.expires).toLocaleString() : "—"}</div>
            </div>
          </div>`;
      }).join("");
    }
  }

  if (fGaugeList) {
    if (gauges.length === 0) {
      fGaugeList.innerHTML = `<div class="e-none">No active USGS stream gauges found within ~35 miles.</div>`;
    } else {
      const sorted = [...gauges].sort((a, b) => b.gaugeHeight - a.gaugeHeight);
      fGaugeList.innerHTML = sorted.slice(0, 10).map(g => `
        <div class="e-row">
          <div class="e-mag" style="background:#2563eb;font-size:12px;min-width:62px;">${g.gaugeHeight} ft</div>
          <div class="e-row-body">
            <div class="e-row-place">${g.name}</div>
            <div class="e-row-meta">${g.time ? "Reading from " + new Date(g.time).toLocaleString() : ""}${g.siteCode ? ` · <a href="https://waterdata.usgs.gov/monitoring-location/${g.siteCode}/" target="_blank" rel="noopener" style="color:var(--green,#16a34a);text-decoration:none;">USGS gauge page →</a>` : ""}</div>
          </div>
        </div>`).join("");
      if (gauges.length > 10) {
        fGaugeList.innerHTML += `<div class="e-more">+ ${gauges.length - 10} more gauges (all shown on the map)</div>`;
      }
    }
  }

  if (fEmpty)   fEmpty.style.display = "none";
  if (fLoading) fLoading.style.display = "none";
  if (fResults) fResults.style.display = "block";
  const latestSection = document.getElementById("fLatestSection");
  if (latestSection) latestSection.style.display = "none";

  setTimeout(() => {
    renderFloodMap(loc.lat, loc.lng, gauges);
    if (fMap) fMap.invalidateSize();
  }, 100);
}

function showFloodError(msg) {
  if (fLoading) fLoading.style.display = "none";
  if (fResults) fResults.style.display = "none";
  if (fEmpty) { fEmpty.style.display = "block"; fEmpty.textContent = msg; }
}

// ── NATIONWIDE ACTIVE FLOOD WARNINGS (loads on page open) ─────────────
async function loadNationalFloodAlerts() {
  const el = document.getElementById("fLatest");
  if (!el) return;
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?event=${encodeURIComponent("Flood Warning,Flash Flood Warning")}`);
    if (!res.ok) throw new Error();
    const d = await res.json();
    const alerts = (d?.features ?? []).slice(0, 10);
    if (alerts.length === 0) {
      el.innerHTML = `<div class="e-none">No active flood or flash flood warnings anywhere in the U.S. right now.</div>`;
      return;
    }
    const sevColor = { Extreme: "#7f1d1d", Severe: "#dc2626", Moderate: "#d97706", Minor: "#16a34a" };
    el.innerHTML = alerts.map(a => {
      const p = a.properties ?? {};
      return `
        <div class="e-row" style="border-left:3px solid ${sevColor[p.severity] || "#d97706"};">
          <div class="e-mag" style="background:${sevColor[p.severity] || "#d97706"};font-size:11px;min-width:70px;">${p.severity ?? "Alert"}</div>
          <div class="e-row-body">
            <div class="e-row-place">${p.event ?? "Flood Warning"} — ${p.areaDesc ?? ""}</div>
            <div class="e-row-meta">${p.headline ?? ""}</div>
            <div class="e-row-meta">Expires: ${p.expires ? new Date(p.expires).toLocaleString() : "—"}</div>
          </div>
        </div>`;
    }).join("");
  } catch (_) {
    el.innerHTML = `<div class="e-none">Couldn't load the national flood warning feed right now.</div>`;
  }
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchFlood(zip) {
  zip = (zip || fZipInput?.value.trim() || "").toString();
  if (!/^\d{5}$/.test(zip)) {
    if (fZipError) { fZipError.textContent = "Please enter a valid 5-digit ZIP code."; fZipError.classList.remove("hidden"); }
    return;
  }
  if (fZipError) { fZipError.textContent = ""; fZipError.classList.add("hidden"); }

  if (fEmpty)   fEmpty.style.display = "none";
  if (fResults) fResults.style.display = "none";
  if (fLoading) fLoading.style.display = "block";

  try {
    const loc = await fFetchZipInfo(zip);
    if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) {
      showFloodError("We couldn't find that ZIP code. Double-check it and try again.");
      return;
    }

    const [zone, alerts, gauges] = await Promise.all([
      fetchFloodZone(loc.lat, loc.lng),
      fetchFloodAlerts(loc.lat, loc.lng),
      fetchGauges(loc.lat, loc.lng),
    ]);

    renderFlood(zip, loc, zone, alerts, gauges);

    const url = new URL(window.location);
    url.searchParams.set("zip", zip);
    window.history.replaceState({}, "", url);
  } catch (_) {
    showFloodError("Something went wrong fetching flood data. Please try again.");
  }
}

// ── EVENTS ─────────────────────────────────────────────────────────────
fSearchBtn?.addEventListener("click", () => searchFlood());
fZipInput?.addEventListener("keydown", e => { if (e.key === "Enter") searchFlood(); });

window.addEventListener("load", () => {
  loadNationalFloodAlerts();
  const params = new URLSearchParams(window.location.search);
  const zipParam = params.get("zip");
  if (zipParam && /^\d{5}$/.test(zipParam)) {
    if (fZipInput) fZipInput.value = zipParam;
    searchFlood(zipParam);
  }
});