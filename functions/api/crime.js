export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const zip = url.searchParams.get("zip");

    if (!zip) {
      return new Response(
        JSON.stringify({ error: "ZIP code is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = env.FBI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // FBI Crime Data API (county-level)
    const fbiUrl =
      `https://api.usa.gov/crime/fbi/cde/arrest/state/CA/all?API_KEY=${apiKey}`;

    const fbiRes = await fetch(fbiUrl);
    const fbiData = await fbiRes.json();

    return new Response(
      JSON.stringify({
        zip,
        message: "FBI API connected successfully",
        sample: fbiData.results?.[0] || null,
        source: "FBI Crime Data API"
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
