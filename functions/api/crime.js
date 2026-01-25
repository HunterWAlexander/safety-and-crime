export async function onRequest() {
  return new Response(JSON.stringify({ ok: true, source: "FUNCTION" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-FUNCTION-HIT": "yes"
    }
  });
}
