export async function onRequest() {
  return new Response("PING OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
      "X-PAGES-FUNCTION": "yes"
    }
  });
}
