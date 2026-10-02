import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Two builds of one UI:
 *
 *   vite build                 the page `systemathic serve` serves, talking to that host  (dist/)
 *   vite build --mode static   a site that stands alone: the host runs in the browser   (dist-static/)
 *
 * `pnpm dev` talks to a host started with `systemathic serve`; `pnpm dev:static` runs on its own.
 */

/** Pyodide's runtime files, where the browser host looks for them: `pyodide/` beside the page. */
const PYODIDE_FILES = ["pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

function pyodideFiles(): Plugin {
  const fromHostBrowser = createRequire(join(__dirname, "../host-browser/package.json"));
  const folder = dirname(fromHostBrowser.resolve("pyodide/package.json"));
  const types: Record<string, string> = { mjs: "text/javascript", wasm: "application/wasm", zip: "application/zip", json: "application/json" };
  return {
    name: "systemathic-pyodide-files",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = request.url?.match(/\/pyodide\/([^?]+)/)?.[1];
        if (!name || !PYODIDE_FILES.includes(name)) return next();
        response.setHeader("content-type", types[name.split(".").pop()!] ?? "application/octet-stream");
        response.end(readFileSync(join(folder, name)));
      });
    },
    generateBundle() {
      for (const name of PYODIDE_FILES) this.emitFile({ type: "asset", fileName: `pyodide/${name}`, source: readFileSync(join(folder, name)) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const standalone = mode === "static";
  return {
    base: standalone ? "./" : "/",
    plugins: [react(), ...(standalone ? [pyodideFiles()] : [])],
    server: standalone ? {} : { proxy: { "/api": process.env.SYSTEMATHIC_HOST ?? "http://127.0.0.1:4747" } },
    optimizeDeps: { exclude: ["pyodide"] },
    worker: { format: "es" },
    build: { outDir: standalone ? "dist-static" : "dist", emptyOutDir: true },
  };
});
