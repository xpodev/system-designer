import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `pnpm dev` talks to a host started with `systemathic serve`; `pnpm build` makes what it serves.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": process.env.SYSTEMATHIC_HOST ?? "http://127.0.0.1:4747" } },
  build: { outDir: "dist", emptyOutDir: true },
});
