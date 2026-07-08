// ---------------------------
// Safety & Crime — hub-nav.js
// Injects the shared header into #hub-header on every page.
// This is the ONLY file that needs editing to change the header/tabs site-wide.
// ---------------------------

// ── TAB DEFINITIONS ──────────────────────────────────────────────────
// `match` = which page filenames this tab should appear "active" on.
// `comingSoon: true` tabs render disabled with a "Soon" badge and no link.
const HUB_TABS = [
  { label: "ZIP Code Search", icon: "🚨", href: "/crime.html",       match: ["crime.html", "index.html", ""] },
  { label: "Weather",         icon: "🌦️", href: "/weather.html",      match: ["weather.html"] },
  { label: "Earthquake Risk", icon: "🌎", href: "/earthquake.html",   match: ["earthquake.html"],  comingSoon: true },
  { label: "Recalls",         icon: "📦", href: "/recalls.html",      match: ["recalls.html"],     comingSoon: true },
];

// ── BUILD HEADER HTML ────────────────────────────────────────────────
function buildHubHeader() {
  const path = window.location.pathname.split("/").pop(); // e.g. "crime.html" or "" for homepage

  const tabsHtml = HUB_TABS.map(tab => {
    const isActive = tab.match.includes(path);
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
        <input id="hubZipInput" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="Enter ZIP code" />
        <button id="hubSearchBtn">Search</button>
      </div>
    </div>
    <nav class="hub-tabs" aria-label="Site tools">
      ${tabsHtml}
    </nav>
  `;
}

// ── GLOBAL SEARCH BEHAVIOR ───────────────────────────────────────────
// Always routes to the ZIP Code Search tool with the ZIP pre-filled,
// regardless of which page the search was triggered from.
function hubSearch() {
  const input = document.getElementById("hubZipInput");
  const zip = input?.value.trim();
  if (!/^\d{5}$/.test(zip)) {
    input?.focus();
    return;
  }
  window.location.href = `/crime.html?zip=${zip}`;
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
}

document.addEventListener("DOMContentLoaded", initHubHeader);