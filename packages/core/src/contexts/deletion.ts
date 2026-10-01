/**
 * Deletion in Contexts is not purely local (docs/foundation.md, "Deletion"): a Domain that
 * loses a Language it inherited takes out the Transformations that fall out of its scope, and
 * a Mediation that loses its witness goes too. Only what the removal broke goes; what was
 * already out of scope or unwitnessed stays, for the diagnoser to show.
 */
import type { Graph } from "../kernel/graph.js";
import { cascade, type Composition } from "../kernel/removal.js";
import { inScope, witnessed } from "./scope.js";

/** Removes `roots` with their cascade, then whatever that took out of scope or left unwitnessed. */
export function removeWithScope(graph: Graph, roots: readonly string[], rules: Composition): string[] {
  const scoped = graph.ofEntity("Transformation").filter((t) => inScope(graph, t));
  const witnessedBefore = graph.ofEntity("Mediation").filter((m) => witnessed(graph, m));
  const removed = cascade(graph, roots, rules);
  for (;;) {
    const lost = [
      ...scoped.filter((t) => graph.has(t) && !inScope(graph, t)),
      ...witnessedBefore.filter((m) => graph.has(m) && !witnessed(graph, m)),
    ];
    if (lost.length === 0) return removed;
    removed.push(...cascade(graph, lost, rules));
  }
}
