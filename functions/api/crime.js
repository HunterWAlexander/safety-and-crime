// functions/api/crime.js

export async function onRequest() {
  return new Response("FUNCTION HIT", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store"
    }
  });
}
