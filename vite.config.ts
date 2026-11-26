import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidVue } from "@void/vue/plugin";

export default defineConfig({
  plugins: [voidPlugin(), voidVue()],
  environments: {
    void_worker: {
      optimizeDeps: {
        // Pre-bundle Dashboard dependencies together to avoid reloading Vue during SSR.
        include: ["vue", "vue/server-renderer", "zod", "@dnd-kit/vue", "@dnd-kit/collision"],
      },
    },
  },
});
