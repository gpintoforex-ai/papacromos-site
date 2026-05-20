export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update();

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;

          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state !== "activated" || !navigator.serviceWorker.controller) return;
            if (sessionStorage.getItem("papa-cromos-sw-refreshed") === "1") return;
            sessionStorage.setItem("papa-cromos-sw-refreshed", "1");
            window.location.reload();
          });
        });
      })
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });
  });
}
