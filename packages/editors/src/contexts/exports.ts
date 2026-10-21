/**
 * Exports and Imports on a graph, for the editors that add them: an Export of a thing by its
 * Component, an Import of one Component by another, and the route by which one Component
 * reaches something inside another — exported by its owner, and imported from it. Exports are
 * not scoped: what is exported, any Component may import.
 */
import { ancestry, boxOf, importedComponents, imported, keeperOf, type Graph } from "@systemathic/core";

/** The end through which an Export refers to a thing: its Entity's name, lower-cased (`interaction`, `medium`). */
export function exportEnd(graph: Graph, item: string): string {
  return graph.get(item).entity.replace(/^./, (c) => c.toLowerCase());
}

/** The Component a thing belongs to: a Component's parent, an Export's exporter, a Deployment's keeper, anything else's Component. */
export function ownerOf(graph: Graph, item: string): string | undefined {
  const entity = graph.get(item).entity;
  const end = entity === "Component" ? "parent" : entity === "Export" ? "exporter" : entity === "Deployment" ? "keeper" : "component";
  return graph.navigate(item, end)[0];
}

/** What an importer has without importing: a Component, its own and its ancestors' parts; a Deployment, its box's and its keeper's, and their ancestors'. */
function lineageOf(graph: Graph, importer: string): Set<string> {
  if (graph.get(importer).entity !== "Deployment") return new Set(ancestry(graph, importer));
  const anchors = [boxOf(graph, importer), keeperOf(graph, importer)].filter((x): x is string => x !== undefined);
  return new Set(anchors.flatMap((anchor) => ancestry(graph, anchor)));
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

/** A route by which a Component or a Deployment reaches a thing: the Export to make, if any, and the Component to import from. */
interface Route {
  /** `[exporter, item]`: the Export that makes `item` reachable, made if there is none. */
  readonly export?: readonly [string, string];
  readonly from: string;
  /** Whether the importer takes the Export, or imports `from` as a whole. */
  readonly take: boolean;
}

/**
 * How `importer` — a Component, or a Deployment for its needs — reaches `item`, a Component,
 * Deployment, Language, Interaction, Transformation or Medium: nothing to do if it already has
 * access. A Component is imported as a whole; anything else is exported by its owner, and
 * taken. Throws for something no Component owns.
 */
export function route(graph: Graph, importer: string, item: string): Route | null {
  const lineage = lineageOf(graph, importer);
  const owner = ownerOf(graph, item);
  if (graph.get(item).entity === "Component") {
    if (lineage.has(item) || importedComponents(graph, importer).includes(item)) return null;
    return { from: item, take: false };
  }
  if (imported(graph, importer).includes(item) || (owner !== undefined && lineage.has(owner))) return null;
  if (owner === undefined) throw new Error(`no Component owns ${item}, so ${importer} cannot import it`);
  return { export: [owner, item], from: owner, take: true };
}

/** Follows a route: makes its Export, and imports. */
export function follow(graph: Graph, importer: string, route: Route | null): void {
  if (route === null) return;
  const exported = route.export === undefined ? undefined : exportIn(graph, route.export[0], route.export[1]);
  if (route.take && exported !== undefined) take(graph, importer, exported);
  else importIn(graph, importer, route.from);
}

/** Makes `importer` reach `item`, exporting and importing as needed (see `route`). */
export function reach(graph: Graph, importer: string, item: string): void {
  follow(graph, importer, route(graph, importer, item));
}
