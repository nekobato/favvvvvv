import { defineConfig } from "void/config";

export default defineConfig({
  cloudflare: { name: "favvvvvv" },
  head: {
    titleTemplate: "%s | favvvvvv",
    htmlAttrs: { lang: "ja" },
    meta: [
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "theme-color", content: "#f1f9f6" },
    ],
    link: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/favvvvvv-192.png", type: "image/png", sizes: "192x192" },
    ],
  },
  routing: {
    typedRoutes: true,
    headers: { "/*": ["Referrer-Policy: no-referrer"] },
  },
  worker: {
    compatibility_date: "2026-11-20",
    compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"],
  },
});
