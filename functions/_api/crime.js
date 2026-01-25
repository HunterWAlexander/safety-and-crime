export function onRequest(context) {
  const url = new URL(context.request.url);
  const zip = url.searchParams.get("zip") || "missing";

  return new Response(
    JSON.stringify({ ok: true, zip, hit: "crime function" }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}
