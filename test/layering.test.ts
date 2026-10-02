/**
 * The design's layering, checked on the code: packages depend only on the packages below
 * them (docs/tool-design.md), and inside the core a layer imports only the layers below it
 * (`layers_extend_down`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));

const below: Record<string, string[]> = {
  core: [],
  tool: ["core"],
  "tool-json": ["core", "tool"],
  editing: ["core", "tool"],
  editors: ["core", "editing"],
  diagnoser: ["core", "tool", "verifier"],
  verifier: ["core", "tool"],
  "python-host": ["core", "tool", "tool-json", "verifier"],
  perspectives: ["core", "tool", "diagnoser"],
  exporter: ["core", "tool", "verifier"],
  catalog: ["core", "tool", "tool-json", "editing", "editors"],
  host: ["core", "tool", "tool-json", "editing", "editors", "diagnoser", "verifier", "perspectives", "exporter", "catalog"],
  mcp: ["host", "host-node"],
  ui: ["host"],
  "host-node": ["host", "catalog", "python-host"],
  "pyodide-host": ["verifier", "tool-json"],
  "host-browser": ["host", "catalog", "pyodide-host"],
  cli: ["core", "tool", "tool-json", "diagnoser", "verifier", "python-host", "exporter", "host-node"],
};

const coreLayers = ["kernel", "contexts", "operations", "std"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

function imports(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/(?:from|import)\s+"([^"]+)"/g)].map((match) => match[1]!);
}

describe("layering", () => {
  for (const [name, allowed] of Object.entries(below)) {
    it(`${name} depends only on ${allowed.join(", ") || "nothing"}`, () => {
      const manifest = JSON.parse(readFileSync(join(root, "packages", name, "package.json"), "utf8"));
      const own = Object.keys(manifest.dependencies ?? {}).filter((dep) => dep.startsWith("@systemathic/"));
      expect(own.sort()).toEqual(allowed.map((dep) => `@systemathic/${dep}`).sort());
      for (const file of sources(join(root, "packages", name, "src"))) {
        for (const target of imports(file).filter((spec) => spec.startsWith("@systemathic/"))) {
          expect(allowed, `${relative(root, file)} imports ${target}`).toContain(target.slice("@systemathic/".length));
        }
      }
    });
  }

  it("the UI only types against the host: it runs in a browser, as a client over HTTP", () => {
    for (const file of sources(join(root, "packages", "ui", "src"))) {
      for (const line of readFileSync(file, "utf8").split("\n").filter((l) => l.includes('"@systemathic/'))) {
        expect(line, relative(root, file)).toMatch(/^import type /);
      }
    }
  });

  for (const name of ["core", "editors"]) {
    it(`inside ${name}, each core layer imports only the layers below it`, () => {
      layered(join(root, "packages", name, "src"));
    });
  }
});

/** Files in a folder named after a core layer import only from folders of the same or lower layers. */
function layered(src: string): void {
  for (const file of sources(src)) {
    const layer = coreLayers.indexOf(relative(src, file).split(/[\\/]/)[0]!);
    if (layer < 0) continue;
    for (const spec of imports(file).filter((spec) => spec.startsWith("."))) {
      const target = relative(src, join(file, "..", spec)).split(/[\\/]/)[0]!;
      const targetLayer = coreLayers.indexOf(target);
      if (targetLayer >= 0) expect(targetLayer, `${relative(root, file)} imports ${spec}`).toBeLessThanOrEqual(layer);
    }
  }
}
