/**
 * Exports and Imports on a graph, for the editors that add them: an Export of a thing by its
 * Component, an Import of one Component by another, and the route by which one Component
 * reaches something inside another — exported by its owner, re-exported by each Component it
 * is nested in up to one the importer may import from, and imported from there.
 */
import { ancestry, importable, importedComponents, imported, type Graph } from "@systemathic/core";

/** The end through which an Export refers to a thing: its Entity's name, lower-cased (`interaction`, `export`, `medium`). */
export function exportEnd(graph: Graph, item: string): string {
  return graph.get(item).entity.replace(/^./, (c) => c.toLowerCase());
}

/** The Component a thing belongs to: a Component's parent, an Export's exporter, anything else's Component. */
export function ownerOf(graph: Graph, item: string): string | undefined {
  const entity = graph.get(item).entity;
  return graph.navigate(item, entity === "Component" ? "parent" : entity === "Export" ? "exporter" : "component")[0];
}

/** The Export by which `exporter` exports `item` directly, made if there is none. */
export function exportIn(graph: Graph, exporter: string, item: string): string {
  const end = exportEnd(graph, item);
  const found = graph.navigate(exporter, "exports").find((id) => graph.navigate(id, end).includes(item));
  if (found !== undefined) return found;
  let id = `${exporter}:${item}`;
  for (let n = 2; graph.has(id); n++) id = `${exporter}:${item}-${n}`;
  graph.add("Export", id);
  graph.connect(exporter, "exports", id);
  graph.connect(id, end, item);
  return id;
}

/** The Import by which `importer` imports from `from`, made if there is none. */
export function importIn(graph: Graph, importer: string, from: string): string {
  const found = graph.navigate(importer, "imports").find((id) => graph.navigate(id, "from").includes(from));
  if (found !== undefined) return found;
  let id = `${importer}<${from}`;
  for (let n = 2; graph.has(id); n++) id = `${importer}<${from}-${n}`;
  graph.add("Import", id);
  graph.connect(importer, "imports", id);
  graph.connect(id, "from", from);
  return id;
}

/** Makes `importer` take an Export, in its Import from the Export's exporter. */
export function take(graph: Graph, importer: string, exported: string): void {
  const [exporter] = graph.navigate(exported, "exporter");
  if (exporter === undefined) return;
  const id = importIn(graph, importer, exporter);
  if (!graph.navigate(id, "exports").includes(exported)) graph.connect(id, "exports", exported);
}

/** A route by which a Component reaches a thing: the Exports to make, outermost last, and the Component to import from. */
interface Route {
  /** `[exporter, item]` pairs, innermost first; each item after the first is the previous pair's Export. */
  readonly exports: readonly (readonly [string, string])[];
  readonly from: string;
}

/**
 * How `importer` reaches `item` — a Component, Language, Interaction, Transformation or Medium:
 * nothing to do if it already has access; otherwise the Exports to make and where to import
 * from. Throws if `item` is inside no Component `importer` may import from.
 */
export function route(graph: Graph, importer: string, item: string): Route | null {
  const lineage = new Set(ancestry(graph, importer));
  const isComponent = graph.get(item).entity === "Component";
  if (isComponent ? lineage.has(item) || importedComponents(graph, importer).includes(item) : imported(graph, importer).includes(item)) return null;
  const owner = ownerOf(graph, item);
  if (!isComponent && owner !== undefined && lineage.has(owner)) return null;
  const reachable = new Set(importable(graph, importer));
  if (isComponent && reachable.has(item)) return { exports: [], from: item };
  const exports: [string, string][] = [];
  let exporter = owner;
  while (exporter !== undefined && !reachable.has(exporter)) {
    exports.push([exporter, item]);
    exporter = graph.navigate(exporter, "parent")[0];
  }
  if (exporter === undefined) throw new Error(`${importer} can import from no Component that ${item} is inside`);
  exports.push([exporter, item]);
  return { exports, from: exporter };
}

/** Follows a route: makes its Exports, each re-exporting the one before, and imports the last. */
export function follow(graph: Graph, importer: string, route: Route | null): void {
  if (route === null) return;
  if (route.exports.length === 0) {
    importIn(graph, importer, route.from);
    return;
  }
  let exported: string | undefined;
  for (const [exporter, item] of route.exports) exported = exportIn(graph, exporter, exported ?? item);
  take(graph, importer, exported!);
}

/** Makes `importer` reach `item`, exporting and importing as needed (see `route`). */
export function reach(graph: Graph, importer: string, item: string): void {
  follow(graph, importer, route(graph, importer, item));
}
