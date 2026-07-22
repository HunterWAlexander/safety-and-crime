// ---------------------------
// Safety & Crime — hub-nav.js
// Injects the shared header into #hub-header on every page.
// This is the ONLY file that needs editing to change the header/tabs site-wide.
// ---------------------------

// ── THEME BOOTSTRAP (runs immediately so dark mode applies without flash) ──
(function () {
  try {
    if (localStorage.getItem("scTheme") === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (_) { /* localStorage unavailable — default to light */ }
})();

// ── SHARED GEO SEARCH (ZIP or city name) ──────────────────────────────
// Used by the header search and every tool page. Resolves "Houston" or
// "Katy, TX" to a ZIP code (plus the city's full ZIP list when available).
const US_STATE_ABBR = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO",
  "Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID",
  "Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA",
  "Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS",
  "Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
  "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
  "Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
  "Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA",
  "West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY","District of Columbia":"DC",
};

async function geoReverseZip(lat, lng) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d?.countryCode !== "US") return null;
    const zip = (d?.postcode || "").substring(0, 5);
    return /^\d{5}$/.test(zip) ? zip : null;
  } catch (_) { return null; }
}

async function geoResolveToZip(raw) {
  raw = (raw || "").trim();
  if (/^\d{5}$/.test(raw)) return { zip: raw, cityZips: null };
  if (raw.length < 2) return null;

  // Support "City, ST" or "City, State" format
  let name = raw, stateHint = null;
  const parts = raw.split(",").map(s => s.trim());
  if (parts.length > 1 && parts[1]) { name = parts[0]; stateHint = parts[1].toUpperCase(); }

  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`);
    if (!res.ok) return null;
    const d = await res.json();
    let results = (d?.results || []).filter(r => r.country_code === "US");
    if (stateHint) {
      results = results.filter(r => {
        const ab = US_STATE_ABBR[r.admin1] || "";
        return ab === stateHint || (r.admin1 || "").toUpperCase() === stateHint;
      });
    }
    const best = results[0];
    if (!best) return null;

    const stateAb = US_STATE_ABBR[best.admin1] || null;

    // Full ZIP list for the city (Zippopotam city endpoint) — used to plot
    // every ZIP in the city on the crime map
    let cityZips = null;
    if (stateAb) {
      try {
        const zr = await fetch(`https://api.zippopotam.us/us/${stateAb.toLowerCase()}/${encodeURIComponent(best.name.toLowerCase())}`);
        if (zr.ok) {
          const zd = await zr.json();
          cityZips = (zd?.places || []).map(p => ({
            zip: p["post code"],
            lat: parseFloat(p.latitude),
            lng: parseFloat(p.longitude),
          })).filter(z => /^\d{5}$/.test(z.zip) && Number.isFinite(z.lat));
          if (cityZips.length === 0) cityZips = null;
        }
      } catch (_) { /* zip list is a bonus */ }
    }

    // Primary ZIP: reverse-geocode the city center; fall back to first listed ZIP
    let zip = await geoReverseZip(best.latitude, best.longitude);
    if (!zip && cityZips?.length) zip = cityZips[0].zip;
    if (!zip) return null;

    return { zip, cityZips, cityName: best.name, state: stateAb };
  } catch (_) { return null; }
}

// ── TAB DEFINITIONS ──────────────────────────────────────────────────
// `match` = which page filenames this tab should appear "active" on.
// `comingSoon: true` tabs render disabled with a "Soon" badge and no link.
const HUB_TABS = [
  { label: "ZIP Code Search", icon: "🚨", href: "/crime.html",       match: ["crime.html", "index.html", ""] },
  { label: "Weather",         icon: "🌦️", href: "/weather.html",      match: ["weather.html"] },
  { label: "Earthquake Risk", icon: "🌎", href: "/earthquake.html",   match: ["earthquake.html"] },
  { label: "Flood Risk",      icon: "🌊", href: "/flood.html",        match: ["flood.html"] },
  { label: "Wildfires",       icon: "🔥", href: "/wildfire.html",     match: ["wildfire.html"] },
  { label: "Tsunami",         icon: "🌐", href: "/tsunami.html",      match: ["tsunami.html"] },
  { label: "Recalls",         icon: "📦", href: "/recalls.html",      match: ["recalls.html"] },
  { label: "Registry",        icon: "🛡️", href: "/registry.html",     match: ["registry.html"] },
  { label: "Guides",          icon: "📖", href: "/blog/",             match: ["blog"] },
];

// ── BUILD HEADER HTML ────────────────────────────────────────────────
function buildHubHeader() {
  const fullPath = window.location.pathname;
  const inBlog = fullPath.startsWith("/blog");
  const path = fullPath.split("/").pop(); // e.g. "crime.html" or "" for homepage

  const tabsHtml = HUB_TABS.map(tab => {
    const isActive = inBlog ? tab.match.includes("blog") : tab.match.includes(path);
    if (tab.comingSoon) {
      return `<span class="hub-tab coming-soon">
        <span>${tab.icon}</span><span>${tab.label}</span>
        <span class="hub-tab-badge">Soon</span>
      </span>`;
    }
    return `<a href="${tab.href}" class="hub-tab${isActive ? " active" : ""}">
      <span>${tab.icon}</span><span>${tab.label}</span>
    </a>`;
  }).join("");

  return `
    <div class="hub-row-top">
      <a href="/" class="hub-brand">
        <span class="hub-brand-mark">🛡️</span>
        <span class="hub-brand-title">Safety &amp; Crime</span>
      </a>
      <div class="hub-search-row">
        <input id="hubZipInput" autocomplete="off" placeholder="ZIP code or city" />
        <button id="hubSearchBtn">Search</button>
        <button id="hubThemeBtn" class="hub-theme-btn" aria-label="Toggle dark mode" title="Toggle dark mode">🌙</button>
      </div>
    </div>
    <nav class="hub-tabs" aria-label="Site tools">
      ${tabsHtml}
    </nav>
  `;
}

// ── GLOBAL SEARCH BEHAVIOR ───────────────────────────────────────────
// On a tool page (weather/earthquake/flood), search stays on that tool.
// Everywhere else it routes to the ZIP Code Search. City searches pass the
// raw query (?q=) so crime.html can plot every ZIP in the city.
async function hubSearch() {
  const input = document.getElementById("hubZipInput");
  const raw = input?.value?.trim() || "";
  const r = await geoResolveToZip(raw);
  if (!r?.zip) {
    input?.focus();
    if (input) { input.value = ""; input.placeholder = "Try a ZIP or city, e.g. Houston, TX"; }
    return;
  }

  const page = window.location.pathname.split("/").pop();
  const toolPages = ["weather.html", "earthquake.html", "flood.html"];
  if (toolPages.includes(page)) {
    window.location.href = `/${page}?zip=${r.zip}`;
  } else if (r.cityZips?.length) {
    window.location.href = `/crime.html?q=${encodeURIComponent(raw)}`;
  } else {
    window.location.href = `/crime.html?zip=${r.zip}`;
  }
}

// ── INIT ──────────────────────────────────────────────────────────────
function initHubHeader() {
  const mount = document.getElementById("hub-header");
  if (!mount) return; // page doesn't have the placeholder, skip silently

  mount.innerHTML = buildHubHeader();

  const searchBtn = document.getElementById("hubSearchBtn");
  const zipInput = document.getElementById("hubZipInput");

  searchBtn?.addEventListener("click", hubSearch);
  zipInput?.addEventListener("keydown", e => {
    if (e.key === "Enter") hubSearch();
  });

  // Dark mode toggle
  const themeBtn = document.getElementById("hubThemeBtn");
  const setThemeIcon = () => {
    if (themeBtn) themeBtn.textContent = document.documentElement.classList.contains("dark") ? "☀️" : "🌙";
  };
  setThemeIcon();
  themeBtn?.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("scTheme", dark ? "dark" : "light"); } catch (_) {}
    setThemeIcon();
  });
}

document.addEventListener("DOMContentLoaded", initHubHeader);