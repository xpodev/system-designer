/**
 * Scope, as functions on a model (docs/foundation.md, *Component*, *Export* and *Import*).
 * These are conveniences for clients — what to offer in a list, what to show as reachable —
 * and say nothing the axioms do not: well-formedness is checked by evaluating the axioms.
 */
import type { Graph } from "../kernel/graph.js";

/** The ends through which an Export refers to what it exports; `medium` is Mediation's. */
const TARGETS = ["component", "interaction", "transformation", "language", "medium"] as const;

/** `C.*parent`: a Component and every Component it is nested in, nearest first. */
export function ancestry(graph: Graph, component: string): string[] {
  const found: string[] = [];
  let current: string | undefined = component;
  while (current !== undefined && graph.has(current) && !found.includes(current)) {
    found.push(current);
    [current] = graph.navigate(current, "parent");
  }
  return found;
}

/** The Components beside `component`: its parent's other children; for the root and the packages, each other. */
export function siblings(graph: Graph, component: string): string[] {
  const [parent] = graph.navigate(component, "parent");
  return (parent !== undefined ? graph.navigate(parent, "components") : topLevel(graph)).filter((id) => id !== component);
}

/** The Components nested in none: every System's root and packages. */
export function topLevel(graph: Graph): string[] {
  return graph.ofEntity("System").flatMap((system) => [...graph.navigate(system, "root"), ...graph.navigate(system, "packages")]);
}

/** `e.<target>`: what an Export makes reachable. */
export function resolve(graph: Graph, exported: string): string | undefined {
  if (!graph.has(exported)) return undefined;
  const ends = graph.vocabulary.reachable(graph.get(exported).entity);
  for (const end of TARGETS) {
    const [target] = ends.has(end) ? graph.navigate(exported, end) : [];
    if (target !== undefined) return target;
  }
  return undefined;
}

/** Of `ids`, the distinct ones whose Entity is `entity`, or all of them. */
function ofEntity(graph: Graph, ids: Iterable<string | undefined>, entity?: string): string[] {
  const found = new Set<string>();
  for (const id of ids) if (id !== undefined && graph.has(id) && (entity === undefined || graph.get(id).entity === entity)) found.add(id);
  return [...found];
}

/** What a Component exports, resolved: its API, of one Entity or of all. */
export function offered(graph: Graph, component: string, entity?: string): string[] {
  return ofEntity(graph, graph.navigate(component, "exports").map((id) => resolve(graph, id)), entity);
}

/** `C.imports.exports`: what a Component's Imports resolve to, of one Entity or of all. */
export function imported(graph: Graph, component: string, entity?: string): string[] {
  const exports = graph.navigate(component, "imports").flatMap((id) => graph.navigate(id, "exports"));
  return ofEntity(graph, exports.map((id) => resolve(graph, id)), entity);
}

/** The Components a Component imports, and so may place: those its Imports are from, and those they resolve to. */
export function importedComponents(graph: Graph, component: string): string[] {
  const from = graph.navigate(component, "imports").flatMap((id) => graph.navigate(id, "from"));
  return ofEntity(graph, [...from, ...imported(graph, component, "Component")]);
}

/** `scope(C) = (C.*parent).languages ∪ C.imports.exports.language`: the Languages a Component may use. */
export function scope(graph: Graph, component: string): string[] {
  const found = new Set<string>();
  for (const owner of ancestry(graph, component)) for (const language of graph.navigate(owner, "languages")) found.add(language);
  for (const language of imported(graph, component, "Language")) found.add(language);
  return [...found];
}

/** The Components a Component may import from: every other Component, wherever it is. Exports are not scoped. */
export function importable(graph: Graph, component: string): string[] {
  return graph.ofEntity("Component").filter((id) => id !== component);
}

/**
 * Whether a Deployment of `deployed` may place an Instance of `component`, once it imports it:
 * a Component of no parent, one its own ancestors hold, or one its parent exports.
 */
export function placeable(graph: Graph, deployed: string, component: string): boolean {
  const [parent] = graph.navigate(component, "parent");
  if (parent === undefined || ancestry(graph, deployed).includes(parent)) return true;
  return graph.navigate(parent, "exports").some((e) => graph.navigate(e, "component").includes(component));
}

/** What a Component may export: its own Languages, Interactions, Transformations and Mediums, and its children. */
export function exportable(graph: Graph, component: string): string[] {
  const ends = graph.vocabulary.reachable("Component");
  return ["languages", "interactions", "transformations", "mediums", "components"].flatMap((end) => (ends.has(end) ? graph.navigate(component, end) : []));
}

/**
 * What a Component has access to of one kind, named by the end through which a Component
 * owns it (`interactions`) and by its Entity (`Interaction`): its own and its ancestors'
 * (direct access), and what its Imports resolve to.
 */
export function access(graph: Graph, component: string, owning: string, entity: string): string[] {
  const found = new Set<string>();
  for (const owner of ancestry(graph, component)) for (const id of graph.navigate(owner, owning)) found.add(id);
  for (const id of imported(graph, component, entity)) found.add(id);
  return [...found];
}

/** The Transformations a Component has access to. */
export function accessibleTransformations(graph: Graph, component: string): string[] {
  return access(graph, component, "transformations", "Transformation");
}
