export async function onRequest() {
  return new Response("FUNCTION HIT v3", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
      "X-Debug": "pages-function-v3"
    }
  });
}
