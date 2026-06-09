// functions/zip.js
// Cloudflare Pages Function — server-side proxy for FBI Crime API + Census Bureau API
// Place this file at: functions/zip.js in your project root

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const zip = url.searchParams.get("zip");

  // CORS headers so your frontend can call this function
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (!zip || !/^\d{5}$/.test(zip)) {
    return new Response(
      JSON.stringify({ error: "Invalid ZIP code" }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // ── Step 1: Census Bureau — resolve ZIP → city, state, lat/lng (no key needed) ──
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/address?benchmark=Public_AR_Current&format=json&zip=${zip}&street=&city=&state=`;
    let city = "Unknown";
    let state = "";
    let lat = null;
    let lng = null;

    try {
      const censusRes = await fetch(censusUrl);
      const censusData = await censusRes.json();
      const match = censusData?.result?.addressMatches?.[0];
      if (match) {
        lat = match.coordinates?.y ?? null;
        lng = match.coordinates?.x ?? null;
      }
    } catch (_) {
      // Census lookup failed — not fatal, continue
    }

    // ── Step 2: ZIP → city/state via Zippopotam (free, no key) ──
    try {
      const zippoRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (zippoRes.ok) {
        const zippoData = await zippoRes.json();
        city = zippoData?.places?.[0]?.["place name"] ?? "Unknown";
        state = zippoData?.places?.[0]?.["state abbreviation"] ?? "";
        if (!lat) lat = parseFloat(zippoData?.places?.[0]?.["latitude"]) || null;
        if (!lng) lng = parseFloat(zippoData?.places?.[0]?.["longitude"]) || null;
      }
    } catch (_) {
      // Zippopotam failed — not fatal
    }

    // ── Step 3: FBI Crime Data API — get crime stats for the state ──
    const FBI_KEY = env.FBI_API_Key;
    const FBI_BASE = "https://api.usa.gov/crime/fbi/sapi";

    let violentCrime = null;
    let propertyCrime = null;
    let dataYear = null;
    let agencyName = null;

    if (FBI_KEY && state) {
      try {
        // First: get list of agencies for this state
        const agencyRes = await fetch(
          `${FBI_BASE}/api/agencies/byStateAbbr/${state}?api_key=${FBI_KEY}`
        );
        const agencyData = await agencyRes.json();
        const agencies = agencyData?.results ?? [];

        // Try to find a city-level police dept that matches our city
        const cityLower = city.toLowerCase();
        let matchedAgency = agencies.find(
          (a) =>
            a.agency_name?.toLowerCase().includes(cityLower) &&
            a.agency_type_name === "City"
        );

        // Fall back to the first city-type agency in the state
        if (!matchedAgency) {
          matchedAgency = agencies.find((a) => a.agency_type_name === "City");
        }

        if (matchedAgency) {
          const ori = matchedAgency.ori;
          agencyName = matchedAgency.agency_name;

          // Fetch violent crime summary for this agency
          const [violentRes, propertyRes] = await Promise.all([
            fetch(`${FBI_BASE}/api/summarized/agencies/${ori}/violent-crime?api_key=${FBI_KEY}`),
            fetch(`${FBI_BASE}/api/summarized/agencies/${ori}/property-crime?api_key=${FBI_KEY}`),
          ]);

          const violentData = await violentRes.json();
          const propertyData = await propertyRes.json();

          // Get most recent year's data
          const violentResults = violentData?.results ?? [];
          const propertyResults = propertyData?.results ?? [];

          if (violentResults.length > 0) {
            const latest = violentResults[violentResults.length - 1];
            violentCrime = latest.violent_crime ?? latest.actual ?? null;
            dataYear = latest.data_year ?? null;
          }

          if (propertyResults.length > 0) {
            const latest = propertyResults[propertyResults.length - 1];
            propertyCrime = latest.property_crime ?? latest.actual ?? null;
            if (!dataYear) dataYear = latest.data_year ?? null;
          }
        }
      } catch (_) {
        // FBI API call failed — will return null values, frontend uses fallback
      }
    }

    // ── Step 4: Calculate a safety score (0–100, higher = safer) ──
    // Score is based on crimes per 100k — national average violent ~380, property ~2100
    let safetyScore = null;
    let riskLevel = "Unknown";

    if (violentCrime !== null && propertyCrime !== null) {
      // Weighted index: violent crime weighted 3x more than property
      const weightedCrime = violentCrime * 3 + propertyCrime;
      // National baseline weighted: 380*3 + 2100 = 3240
      // Score: 100 - clamp((weightedCrime / 3240) * 50, 0, 100)
      const rawScore = Math.max(0, Math.min(100, 100 - (weightedCrime / 3240) * 50));
      safetyScore = Math.round(rawScore);

      if (safetyScore >= 70) riskLevel = "Low Risk";
      else if (safetyScore >= 40) riskLevel = "Medium Risk";
      else riskLevel = "High Risk";
    }

    // ── Step 5: Return everything to the frontend ──
    const payload = {
      zip,
      city,
      state,
      lat,
      lng,
      agencyName,
      violentCrime,
      propertyCrime,
      dataYear,
      safetyScore,
      riskLevel,
      // Flag whether we have real data or need the frontend to use mock
      hasRealData: violentCrime !== null && propertyCrime !== null,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", detail: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}