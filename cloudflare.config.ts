import config from "./void.config.ts";

// Void supplies the full Worker configuration through its Vite plugin.
export default {
  worker: {
    name: config.cloudflare?.name,
    compatibilityDate: config.worker?.compatibility_date,
    compatibilityFlags: config.worker?.compatibility_flags,
  },
};
