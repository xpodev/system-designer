/**
 * Scope, as functions on a model (docs/foundation.md, *Component* and *Import*). These are
 * conveniences for clients — what to offer in a list, what to show as reachable — and say
 * nothing the axioms do not: well-formedness is checked by evaluating the axioms.
 */
import type { Graph } from "../kernel/graph.js";

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

/** The Components beside `component`: its parent's other children, or the System's other top-level Components. */
export function siblings(graph: Graph, component: string): string[] {
  const [parent] = graph.navigate(component, "parent");
  const [system] = graph.navigate(component, "system");
  const all = parent !== undefined ? graph.navigate(parent, "components") : system !== undefined ? graph.navigate(system, "components") : [];
  return all.filter((id) => id !== component);
}

/** `scope(C) = (C.*parent).languages ∪ C.importedComponents.languages`: the Languages a Component may use. */
export function scope(graph: Graph, component: string): string[] {
  const found = new Set<string>();
  for (const owner of [...ancestry(graph, component), ...graph.navigate(component, "importedComponents")]) {
    for (const language of graph.navigate(owner, "languages")) found.add(language);
  }
  return [...found];
}

/**
 * What a Component may import of one kind — Components, Interactions, Transformations or
 * Mediums — named by the end through which a Component offers them (`interactions`) and the
 * end through which it imports them (`importedInteractions`). It is what its siblings offer,
 * what each Component it is nested in imports, and what the Components those import offer.
 * Components themselves are offered by being siblings: pass `null` as the offering end.
 */
export function importable(graph: Graph, component: string, offering: string | null, importing: string): string[] {
  const found = new Set<string>();
  const offered = (owner: string) => (offering === null ? [owner] : graph.navigate(owner, offering));
  for (const sibling of siblings(graph, component)) for (const id of offered(sibling)) found.add(id);
  for (const ancestor of ancestry(graph, component).slice(1)) {
    for (const id of graph.navigate(ancestor, importing)) found.add(id);
    if (offering !== null) for (const imported of graph.navigate(ancestor, "importedComponents")) for (const id of offered(imported)) found.add(id);
  }
  if (offering !== null) for (const imported of graph.navigate(component, "importedComponents")) for (const id of offered(imported)) found.add(id);
  return [...found];
}

/**
 * What a Component has access to of one kind: its own and its ancestors' (direct access),
 * what it imports, and what the Components it imports offer.
 */
export function access(graph: Graph, component: string, offering: string, importing: string): string[] {
  const found = new Set<string>();
  for (const owner of ancestry(graph, component)) for (const id of graph.navigate(owner, offering)) found.add(id);
  for (const id of graph.navigate(component, importing)) found.add(id);
  for (const imported of graph.navigate(component, "importedComponents")) for (const id of graph.navigate(imported, offering)) found.add(id);
  return [...found];
}

/** The Transformations a Component may import. */
export function importableTransformations(graph: Graph, component: string): string[] {
  return importable(graph, component, "transformations", "importedTransformations");
}

/** The Transformations a Component has access to. */
export function accessibleTransformations(graph: Graph, component: string): string[] {
  return access(graph, component, "transformations", "importedTransformations");
}

/** The Components a Component may import. */
export function importableComponents(graph: Graph, component: string): string[] {
  return importable(graph, component, null, "importedComponents");
}
