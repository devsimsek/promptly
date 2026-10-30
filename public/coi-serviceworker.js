// coi-serviceworker: applies COOP/COEP at fetch time so the page builds
// crossOriginIsolated = true and ONNX Runtime may use WASM threads.
// The service worker itself is invisible storage it never caches; it maps
// responses with the isolation headers only. GitHub Pages serves static
// files without these headers, hence this runtime approach.
//
// COEP uses credentialless rather than require-corp: cross-origin model
// downloads from huggingface.co and related CDNs keep working without
// per-resource CORP opt-ins, while requests carry no credentials.

const COEP = "credentialless";
const COOP = "same-origin";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  let requestObject = request;
  if (request.mode === "navigate" && request.method === "GET") {
    requestObject = new Request(request.url, {
      method: "GET",
      headers: request.headers,
      redirect: request.redirect,
      mode: "same-origin",
    });
  }
  event.respondWith(
    fetch(requestObject)
      .then((response) => {
        if (response.status === 0) return response;
        const headers = new Headers(response.headers);
        headers.set("Cross-Origin-Embedder-Policy", COEP);
        if (request.mode === "navigate") headers.set("Cross-Origin-Opener-Policy", COOP);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      })
      .catch((error) => {
        event.respondWith(new Response(String(error)));
        return fetch(requestObject);
      })
  );
});
