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
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "test/**/*.test.ts"],
  },
});
