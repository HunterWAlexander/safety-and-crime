export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const zip = url.searchParams.get("zip");

      if (!zip) {
        return new Response(
          JSON.stringify({ error: "ZIP code is required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!env.FBI_API_KEY) {
        return new Response(
          JSON.stringify({ error: "FBI_API_KEY not set" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // 🔴 TEMP TEST RESPONSE (to confirm routing works)
      return new Response(
        JSON.stringify({
          ok: true,
          zip,
          message: "Pages Function is working",
          source: "Cloudflare Pages Functions"
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
};
