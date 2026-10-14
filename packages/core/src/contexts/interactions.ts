/** Interactions in scope (docs/foundation.md, *Import*): what a Component has access to. */
import { access } from "./scope.js";
import type { Graph } from "../kernel/graph.js";

/** The Interactions a Component has access to: its own and its ancestors', and those its Imports resolve to. */
export function accessibleInteractions(graph: Graph, component: string): string[] {
  return access(graph, component, "interactions", "Interaction");
}
