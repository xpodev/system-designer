import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@systemathic/core": source("core"),
      "@systemathic/tool": source("tool"),
      "@systemathic/tool-json": source("tool-json"),
      "@systemathic/editing": source("editing"),
      "@systemathic/editors": source("editors"),
      "@systemathic/diagnoser": source("diagnoser"),
      "@systemathic/verifier": source("verifier"),
      "@systemathic/python-host": source("python-host"),
      "@systemathic/perspectives": source("perspectives"),
      "@systemathic/exporter": source("exporter"),
      "@systemathic/catalog": source("catalog"),
      "@systemathic/host": source("host"),
      "@systemathic/mcp": source("mcp"),
      "@systemathic/host-node": source("host-node"),
      "@systemathic/pyodide-host": source("pyodide-host"),
      "@systemathic/host-browser": source("host-browser"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "test/**/*.test.ts"],
  },
});
