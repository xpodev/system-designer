/**
 * An Interaction's Parameters are ordered by a first/next chain (Operations). Code wants a
 * list; these two functions are that mediation, in both directions.
 */
import type { Graph } from "../kernel/graph.js";

/** The Parameters of an Interaction in order, following first/next. Stops on a cycle. */
export function parameters(graph: Graph, interaction: string): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  let [current] = graph.navigate(interaction, "first");
  while (current !== undefined && !seen.has(current)) {
    ordered.push(current);
    seen.add(current);
    [current] = graph.navigate(current, "next");
  }
  return ordered;
}

/** Makes `ids` the Interaction's Parameters, in this order. */
export function setParameters(graph: Graph, interaction: string, ids: readonly string[]): void {
  for (const old of graph.navigate(interaction, "parameters")) graph.disconnect(old, "next");
  graph.disconnect(interaction, "parameters");
  graph.disconnect(interaction, "first");
  ids.forEach((id, index) => {
    graph.connect(interaction, "parameters", id);
    if (index === 0) graph.connect(interaction, "first", id);
    else graph.connect(ids[index - 1]!, "next", id);
  });
}
