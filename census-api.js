// ---------------------------
// Safety & Crime — census-api.js
// Real population + median home value from US Census Bureau ACS 5-Year Estimates
// Queried directly by ZCTA (ZIP Code Tabulation Area) — no geocoding step needed
// ---------------------------

// PASTE YOUR CENSUS API KEY HERE (get one free at https://api.census.gov/data/key_signup.html)
const CENSUS_API_KEY = "4cab7791abd780d5fc4658d7f18d1f1c6b01025c";

// ACS 5-Year Estimates — most recent vintage with full ZCTA coverage.
// Bump this each year once the new vintage is released (usually ~Dec).
const CENSUS_ACS_YEAR = 2023;

// Variable codes:
//   B01003_001E = Total Population
//   B25077_001E = Median Home Value (owner-occupied housing units)
const CENSUS_VARIABLES = "B01003_001E,B25077_001E";

/**
 * Fetch real population + median home value for a ZIP code from the Census API.
 * Returns null on any failure (invalid ZIP, no data for that ZCTA, network error, etc.)
 * so callers can gracefully fall back to synthetic/regional data.
 *
 * @param {string} zip - 5-digit ZIP code
 * @returns {Promise<{population: number, homeValue: number, source: string, year: number} | null>}
 */
async function fetchCensusData(zip) {
  if (!/^\d{5}$/.test(zip)) return null;
  if (!CENSUS_API_KEY || CENSUS_API_KEY === "YOUR_CENSUS_KEY") {
    console.warn("Census API key not set — skipping live Census lookup.");
    return null;
  }

  const url =
    `https://api.census.gov/data/${CENSUS_ACS_YEAR}/acs/acs5` +
    `?get=${CENSUS_VARIABLES}` +
    `&for=zip%20code%20tabulation%20area:${zip}` +
    `&key=${CENSUS_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    // Census returns [ ["B01003_001E","B25077_001E","zip code tabulation area"], ["42123","285600","77041"] ]
    if (!Array.isArray(data) || data.length < 2) return null;

    const row = data[1];
    const population = parseInt(row[0], 10);
    const homeValue = parseInt(row[1], 10);

    // Census uses negative sentinel values (e.g. -666666666) for "data not available"
    if (!Number.isFinite(population) || population < 0) return null;
    if (!Number.isFinite(homeValue) || homeValue < 0) return null;

    return {
      population,
      homeValue,
      source: "census",
      year: CENSUS_ACS_YEAR,
    };
  } catch (err) {
    console.warn(`Census API lookup failed for ZIP ${zip}:`, err);
    return null;
  }
}

/**
 * Merge real Census data into an existing scores object (from calcScore()),
 * falling back to the synthetic values already present if Census has no data.
 *
 * @param {string} zip
 * @param {object} scores - result of calcScore(zip), will be mutated and returned
 * @returns {Promise<object>} scores object, with population/homeValue/dataSource set
 */
async function enrichWithCensusData(zip, scores) {
  const census = await fetchCensusData(zip);

  if (census) {
    scores.population = census.population;
    scores.homeValue = census.homeValue;
    scores.dataSource = "census";
    scores.censusYear = census.year;
  } else {
    scores.dataSource = "regional-estimate";
  }

  return scores;
}