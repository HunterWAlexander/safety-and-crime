// ---------------------------
// Safety & Crime — tsunami.js
// Historical tsunamis: NOAA NCEI Global Historical Tsunami Database (free, no key)
// Live alerts: NWS API tsunami events (free, no key)
// ---------------------------

const NCEI_URL = "https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/tsunamis/events";

// ── DOM ────────────────────────────────────────────────────────────────
const tsInput     = document.getElementById("tsInput");
const tsSearchBtn = document.getElementById("tsSearchBtn");
const tsError     = document.getElementById("tsError");
const tsEmpty     = document.getElementById("tsEmpty");
const tsLoading   = document.getElementById("tsLoading");
const tsResults   = document.getElementById("tsResults");
const tsLocation  = document.getElementById("tsLocation");
const tsStats     = document.getElementById("tsStats");
const tsList      = document.getElementById("tsList");

// ── HELPERS ────────────────────────────────────────────────────────────
function tsColor(height) {
  if (height == null) return "#6b7280";
  if (height < 1)  return "#16a34a";
  if (height < 3)  return "#d97706";
  if (height < 10) return "#ea580c";
  return "#dc2626";
}

function tsDate(ev) {
  const y = ev.year, m = ev.month, d = ev.day;
  if (!y) return "Unknown date";
  if (!m) return `${y}`;
  return `${new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, { year: "numeric", month: "short", day: d ? "numeric" : undefined })}`;
}

const TS_CAUSES = { 1: "Earthquake", 2: "Questionable earthquake", 3: "Earthquake + landslide", 4: "Volcano + earthquake", 5: "Volcano", 6: "Volcano + landslide", 7: "Landslide", 8: "Meteorological", 9: "Explosion", 10: "Astronomical tide", 11: "Unknown" };

// ── NCEI QUERY ─────────────────────────────────────────────────────────
async function fetchTsunamis(params) {
  const p = new URLSearchParams({ size: "100", ...params });
  const res = await fetch(`${NCEI_URL}?${p}`);
  if (!res.ok) return null;
  const d = await res.json();
  return d?.items ?? [];
}

// ── MAP ────────────────────────────────────────────────────────────────
let tsMap = null;
let tsMapLayers = [];

function initTsMapBase() {
  const mapEl = document.getElementById("tsMap");
  if (tsMap || !mapEl || typeof L === "undefined") return;
  tsMap = L.map("tsMap").setView([20, 0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors · Tsunamis: NOAA NCEI",
  }).addTo(tsMap);
}

function plotTsunamis(events, fit) {
  initTsMapBase();
  if (!tsMap) return;
  tsMapLayers.forEach(l => tsMap.removeLayer(l));
  tsMapLayers = [];

  const bounds = [];
  events.forEach(ev => {
    if (ev.latitude == null || ev.longitude == null) return;
    const h = ev.maxWaterHeight;
    const m = L.circleMarker([ev.latitude, ev.longitude], {
      radius: Math.max(6, Math.min(16, (h ?? 1) * 1.5)),
      color: tsColor(h), weight: 1.5, fillColor: tsColor(h), fillOpacity: 0.55,
    }).addTo(tsMap).bindPopup(
      `<strong>🌊 ${ev.locationName ?? ev.country ?? "Tsunami"}</strong><br>` +
      `${tsDate(ev)}${h != null ? `<br>Max wave: ${h} m (${(h * 3.281).toFixed(0)} ft)` : ""}` +
      `${ev.deathsTotal != null ? `<br>Deaths: ${ev.deathsTotal.toLocaleString()}` : ""}` +
      `${ev.causeCode != null && TS_CAUSES[ev.causeCode] ? `<br>Cause: ${TS_CAUSES[ev.causeCode]}` : ""}`
    );
    tsMapLayers.push(m);
    bounds.push([ev.latitude, ev.longitude]);
  });

  if (fit && bounds.length > 1) tsMap.fitBounds(bounds, { padding: [30, 30] });
  else if (fit && bounds.length === 1) tsMap.setView(bounds[0], 6);
}

// ── RENDER ─────────────────────────────────────────────────────────────
function renderTsunamis(query, events) {
  if (tsLocation) tsLocation.textContent = `Tsunami history: "${query}" — ${events.length} recorded event${events.length === 1 ? "" : "s"}`;

  const heights = events.map(e => e.maxWaterHeight).filter(h => h != null);
  const maxH = heights.length ? Math.max(...heights) : null;
  const deadliest = events.filter(e => e.deathsTotal != null).sort((a, b) => b.deathsTotal - a.deathsTotal)[0];
  const recent = [...events].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];

  if (tsStats) {
    tsStats.innerHTML = `
      <div class="e-stat">
        <div class="e-stat-label">Recorded Events</div>
        <div class="e-stat-value" style="color:#2563eb;">${events.length}</div>
        <div class="e-stat-sub">in the NOAA historical database</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Largest Wave</div>
        <div class="e-stat-value" style="color:${tsColor(maxH)};">${maxH != null ? maxH + " m" : "—"}</div>
        <div class="e-stat-sub">${maxH != null ? (maxH * 3.281).toFixed(0) + " feet maximum water height" : "no height data"}</div>
      </div>
      <div class="e-stat">
        <div class="e-stat-label">Most Recent</div>
        <div class="e-stat-value" style="font-size:20px;">${recent?.year ?? "—"}</div>
        <div class="e-stat-sub">${recent ? (recent.locationName ?? recent.country ?? "") : ""}</div>
      </div>
    `;
  }

  if (tsList) {
    if (events.length === 0) {
      tsList.innerHTML = `<div class="e-none">No recorded tsunami events found for that search. Try a country name (e.g. "Japan", "Chile", "USA") or a coastal region.</div>`;
    } else {
      const sorted = [...events].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      tsList.innerHTML = sorted.slice(0, 20).map(ev => {
        const h = ev.maxWaterHeight;
        return `
          <div class="e-row">
            <div class="e-mag" style="background:${tsColor(h)};font-size:11px;min-width:64px;line-height:1.3;">${h != null ? h + " m" : "🌊"}</div>
            <div class="e-row-body">
              <div class="e-row-place">${ev.locationName ?? ev.country ?? "Tsunami event"}${ev.country && ev.locationName && !ev.locationName.includes(ev.country) ? ` — ${ev.country}` : ""}</div>
              <div class="e-row-meta">${tsDate(ev)}${ev.causeCode != null && TS_CAUSES[ev.causeCode] ? ` · Cause: ${TS_CAUSES[ev.causeCode]}` : ""}${ev.deathsTotal != null ? ` · ${ev.deathsTotal.toLocaleString()} deaths` : ""}${ev.damageMillionsDollars != null ? ` · $${ev.damageMillionsDollars}M damage` : ""}</div>
            </div>
          </div>`;
      }).join("");
      if (events.length > 20) {
        tsList.innerHTML += `<div class="e-more">Showing 20 most recent of ${events.length} events (all plotted on the map)</div>`;
      }
    }
  }

  if (tsEmpty)   tsEmpty.style.display = "none";
  if (tsLoading) tsLoading.style.display = "none";
  if (tsResults) tsResults.style.display = "block";
  const latestSection = document.getElementById("tsLatestSection");
  if (latestSection) latestSection.style.display = "none";

  setTimeout(() => {
    plotTsunamis(events, true);
    if (tsMap) tsMap.invalidateSize();
  }, 100);
}

function showTsError(msg) {
  if (tsLoading) tsLoading.style.display = "none";
  if (tsResults) tsResults.style.display = "none";
  if (tsEmpty) { tsEmpty.style.display = "block"; tsEmpty.textContent = msg; }
}

// ── LIVE ALERTS + RECENT EVENTS (load on page open) ────────────────────
async function loadTsunamiAlerts() {
  const el = document.getElementById("tsAlertList");
  if (!el) return;
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?event=${encodeURIComponent("Tsunami Warning,Tsunami Advisory,Tsunami Watch")}`);
    if (!res.ok) throw new Error();
    const d = await res.json();
    const alerts = (d?.features ?? []).slice(0, 6);
    if (alerts.length === 0) {
      el.innerHTML = `<div class="e-none">✅ No active tsunami warnings, advisories, or watches for U.S. coastlines right now.</div>`;
      return;
    }
    el.innerHTML = alerts.map(a => {
      const p = a.properties ?? {};
      return `
        <div class="e-row" style="border-left:3px solid #dc2626;">
          <div class="e-mag" style="background:#dc2626;font-size:11px;min-width:70px;">${p.severity ?? "Alert"}</div>
          <div class="e-row-body">
            <div class="e-row-place">${p.event ?? "Tsunami Alert"} — ${p.areaDesc ?? ""}</div>
            <div class="e-row-meta">${p.headline ?? ""}</div>
          </div>
        </div>`;
    }).join("");
  } catch (_) {
    el.innerHTML = `<div class="e-none">Couldn't load live tsunami alerts. Check tsunami.gov for official status.</div>`;
  }
}

async function loadRecentTsunamis() {
  const el = document.getElementById("tsRecentList");
  if (!el) return;
  try {
    const minYear = new Date().getFullYear() - 6;
    const events = await fetchTsunamis({ minYear: String(minYear) });
    if (!events || events.length === 0) {
      el.innerHTML = `<div class="e-none">No tsunami events recorded in the past several years.</div>`;
      return;
    }
    const sorted = [...events].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.month ?? 0) - (a.month ?? 0));
    el.innerHTML = sorted.slice(0, 8).map(ev => {
      const h = ev.maxWaterHeight;
      return `
        <div class="e-row">
          <div class="e-mag" style="background:${tsColor(h)};font-size:11px;min-width:64px;line-height:1.3;">${h != null ? h + " m" : "🌊"}</div>
          <div class="e-row-body">
            <div class="e-row-place">${ev.locationName ?? ev.country ?? "Tsunami event"}${ev.country ? ` — ${ev.country}` : ""}</div>
            <div class="e-row-meta">${tsDate(ev)}${ev.causeCode != null && TS_CAUSES[ev.causeCode] ? ` · ${TS_CAUSES[ev.causeCode]}` : ""}${ev.deathsTotal != null ? ` · ${ev.deathsTotal.toLocaleString()} deaths` : ""}</div>
          </div>
        </div>`;
    }).join("");

    plotTsunamis(sorted.slice(0, 30), false);
  } catch (_) {
    el.innerHTML = `<div class="e-none">Couldn't load recent tsunami history right now.</div>`;
  }
}

// ── MAIN SEARCH ────────────────────────────────────────────────────────
async function searchTsunamis(query) {
  const q = (query || tsInput?.value.trim() || "").toString();
  if (q.length < 2) {
    if (tsError) { tsError.textContent = "Enter a country or coastal location (e.g. Japan, Alaska, Chile)."; tsError.classList.remove("hidden"); }
    return;
  }
  if (tsError) { tsError.textContent = ""; tsError.classList.add("hidden"); }

  if (tsEmpty)   tsEmpty.style.display = "none";
  if (tsResults) tsResults.style.display = "none";
  if (tsLoading) tsLoading.style.display = "block";

  try {
    // Try as country first, then as location name
    let events = await fetchTsunamis({ country: q.toUpperCase() });
    if (!events || events.length === 0) {
      events = await fetchTsunamis({ locationName: q.toUpperCase() });
    }
    if (events == null) {
      showTsError("The NOAA tsunami database isn't responding right now. Please try again in a moment.");
      return;
    }
    renderTsunamis(q, events);

    const url = new URL(window.location);
    url.searchParams.set("q", q);
    window.history.replaceState({}, "", url);
  } catch (_) {
    showTsError("Something went wrong searching the tsunami database. Please try again.");
  }
}

// ── EVENTS ─────────────────────────────────────────────────────────────
tsSearchBtn?.addEventListener("click", () => searchTsunamis());
tsInput?.addEventListener("keydown", e => { if (e.key === "Enter") searchTsunamis(); });

window.addEventListener("load", () => {
  initTsMapBase();
  setTimeout(() => tsMap?.invalidateSize(), 200);
  loadTsunamiAlerts();
  loadRecentTsunamis();
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get("q");
  if (qParam) {
    if (tsInput) tsInput.value = qParam;
    searchTsunamis(qParam);
  }
});