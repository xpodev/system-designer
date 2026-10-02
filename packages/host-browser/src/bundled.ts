/**
 * What a browser host carries with it, built into the page: the standard catalog, the
 * `systemathic` Python package, and the examples a new visitor starts with. The paths are
 * this repository's; the bundler reads them when the page is built.
 */
import { Catalog, parsePackage } from "@systemathic/catalog";

const catalogFiles = import.meta.glob("../../../catalog/*.systemathic.json", { eager: true, import: "default" }) as Record<string, unknown>;

/** The standard catalog. */
export function standardCatalog(): Catalog {
  return new Catalog(
    Object.entries(catalogFiles)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, file]) => parsePackage(file, "standard", path.split("/").pop()!)),
  );
}

const python = import.meta.glob("../../../python/systemathic/*.py", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

/** The `systemathic` package's modules, by file name. */
export const pythonSources: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(python).map(([path, text]) => [path.split("/").pop()!, text]),
);

const examples = {
  ...(import.meta.glob("../../../examples/*.systemathic.json", { eager: true, query: "?raw", import: "default" }) as Record<string, string>),
  ...(import.meta.glob("../../../examples/*.rules.py", { eager: true, query: "?raw", import: "default" }) as Record<string, string>),
};

/** The examples, as `examples/<name>` to their text: the System files and their rule scripts. */
export const exampleFiles: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(examples).map(([path, text]) => [`examples/${path.split("/").pop()!}`, withoutLayout(path, text)]),
);

/** An example as it was written, without the layout someone left in it while using the UI. */
function withoutLayout(path: string, text: string): string {
  if (!path.endsWith(".json")) return text;
  const file = JSON.parse(text) as { attachments?: { owner: string }[] };
  file.attachments = (file.attachments ?? []).filter((attachment) => attachment.owner !== "ui");
  return JSON.stringify(file, null, 2) + "\n";
}
