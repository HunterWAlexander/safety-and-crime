// ---------------------------
// Safety & Crime — recalls.js
// Vehicle recalls: NHTSA API (free, no key)
// Product recalls: CPSC SaferProducts API (free, no key)
// ---------------------------

// ── DOM ────────────────────────────────────────────────────────────────
const rYear   = document.getElementById("rYear");
const rMake   = document.getElementById("rMake");
const rModel  = document.getElementById("rModel");
const rBtn    = document.getElementById("rSearchBtn");
const rError  = document.getElementById("rError");
const rEmpty  = document.getElementById("rEmpty");
const rLoad   = document.getElementById("rLoading");
const rList   = document.getElementById("rVehicleList");
const rTitle  = document.getElementById("rVehicleTitle");

// ── VEHICLE RECALLS (NHTSA) ────────────────────────────────────────────
async function searchVehicleRecalls() {
  const year  = (rYear?.value || "").trim();
  const make  = (rMake?.value || "").trim();
  const model = (rModel?.value || "").trim();

  if (!/^(19|20)\d{2}$/.test(year) || make.length < 2 || model.length < 1) {
    if (rError) { rError.textContent = "Enter a 4-digit year, make, and model (e.g. 2016 Honda Civic)."; rError.classList.remove("hidden"); }
    return;
  }
  if (rError) { rError.textContent = ""; rError.classList.add("hidden"); }
  if (rEmpty) rEmpty.style.display = "none";
  if (rList)  rList.innerHTML = "";
  if (rTitle) rTitle.style.display = "none";
  if (rLoad)  rLoad.style.display = "block";

  try {
    const res = await fetch(
      `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`
    );
    if (rLoad) rLoad.style.display = "none";
    if (!res.ok) throw new Error();
    const d = await res.json();
    const results = d?.results ?? [];

    if (rTitle) {
      rTitle.style.display = "block";
      rTitle.textContent = `Recalls for ${year} ${make.charAt(0).toUpperCase() + make.slice(1)} ${model.charAt(0).toUpperCase() + model.slice(1)} (${results.length})`;
    }

    if (results.length === 0) {
      if (rList) rList.innerHTML = `<div class="e-none">No open recalls found for that vehicle — good news! Double-check spelling if you expected results, and consider a VIN-specific check at nhtsa.gov/recalls for certainty.</div>`;
      return;
    }

    if (rList) {
      rList.innerHTML = results.map(r => `
        <div class="e-row" style="align-items:flex-start;">
          <div class="e-mag" style="background:#dc2626;font-size:10px;min-width:80px;line-height:1.3;padding:8px 6px;">${r.NHTSACampaignNumber ?? "Recall"}</div>
          <div class="e-row-body">
            <div class="e-row-place">${r.Component ?? "Component not specified"}</div>
            ${r.Summary ? `<div class="e-row-meta" style="margin-top:4px;"><strong>Defect:</strong> ${r.Summary}</div>` : ""}
            ${r.Consequence ? `<div class="e-row-meta" style="margin-top:4px;"><strong>Risk:</strong> ${r.Consequence}</div>` : ""}
            ${r.Remedy ? `<div class="e-row-meta" style="margin-top:4px;"><strong>Fix:</strong> ${r.Remedy}</div>` : ""}
            <div class="e-row-meta" style="margin-top:4px;">${r.ReportReceivedDate ? "Reported: " + r.ReportReceivedDate : ""}${r.Manufacturer ? " · " + r.Manufacturer : ""}</div>
          </div>
        </div>`).join("");
      rList.innerHTML += `<div class="e-more">Recall repairs are always <strong>free</strong> at franchised dealers. For a VIN-specific check, visit <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener" style="color:var(--green,#16a34a);">nhtsa.gov/recalls</a>.</div>`;
    }
  } catch (_) {
    if (rLoad) rLoad.style.display = "none";
    if (rList) rList.innerHTML = `<div class="e-none">Couldn't reach the NHTSA recall database right now. Please try again in a moment.</div>`;
  }
}

rBtn?.addEventListener("click", searchVehicleRecalls);
[rYear, rMake, rModel].forEach(el => el?.addEventListener("keydown", e => { if (e.key === "Enter") searchVehicleRecalls(); }));

// ── LATEST PRODUCT RECALLS (CPSC feed, loads on page open) ─────────────
async function loadProductRecalls() {
  const el = document.getElementById("rProductList");
  if (!el) return;
  try {
    const d = new Date(); d.setDate(d.getDate() - 60);
    const start = d.toISOString().substring(0, 10);
    const res = await fetch(`https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${start}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const recalls = (Array.isArray(data) ? data : [])
      .sort((a, b) => new Date(b.RecallDate) - new Date(a.RecallDate))
      .slice(0, 12);

    if (recalls.length === 0) {
      el.innerHTML = `<div class="e-none">No product recalls published in the past 60 days.</div>`;
      return;
    }

    el.innerHTML = recalls.map(r => {
      const product = r.Products?.[0]?.Name ?? "";
      const hazard  = r.Hazards?.map(h => h.Name).filter(Boolean).join("; ") ?? "";
      const remedy  = r.Remedies?.map(x => x.Name).filter(Boolean).join(", ") ?? "";
      const date    = r.RecallDate ? new Date(r.RecallDate).toLocaleDateString() : "";
      return `
        <div class="e-row" style="align-items:flex-start;">
          <div class="e-mag" style="background:#d97706;font-size:11px;min-width:70px;">${date}</div>
          <div class="e-row-body">
            <div class="e-row-place">${r.Title ?? product ?? "Product recall"}</div>
            ${hazard ? `<div class="e-row-meta" style="margin-top:4px;"><strong>Hazard:</strong> ${hazard}</div>` : ""}
            ${remedy ? `<div class="e-row-meta" style="margin-top:4px;"><strong>Remedy:</strong> ${remedy}</div>` : ""}
            ${r.URL ? `<div class="e-row-meta" style="margin-top:4px;"><a href="${r.URL}" target="_blank" rel="noopener" style="color:var(--green,#16a34a);text-decoration:none;">Full CPSC recall notice →</a></div>` : ""}
          </div>
        </div>`;
    }).join("");
  } catch (_) {
    el.innerHTML = `<div class="e-none">Couldn't load the CPSC recall feed right now. You can browse recalls directly at <a href="https://www.cpsc.gov/Recalls" target="_blank" rel="noopener" style="color:var(--green,#16a34a);">cpsc.gov/Recalls</a>.</div>`;
  }
}

window.addEventListener("load", loadProductRecalls);