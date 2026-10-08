/** Interactions in scope (docs/foundation.md, *Import*): what a Component may import, and what it has access to. */
import { access, importable } from "../contexts/scope.js";
import type { Graph } from "../kernel/graph.js";

/** The Interactions a Component may import. */
export function importableInteractions(graph: Graph, component: string): string[] {
  return importable(graph, component, "interactions", "importedInteractions");
}

/** The Interactions a Component has access to: its own and its ancestors', what it imports, and what the Components it imports offer. */
export function accessibleInteractions(graph: Graph, component: string): string[] {
  return access(graph, component, "interactions", "importedInteractions");
}
