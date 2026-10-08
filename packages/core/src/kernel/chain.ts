/**
 * An ordered collection, in the kernel's terms: members linked from their owner, ordered by a
 * first/next chain (an Interaction's Parameters, a Connection's Mediations). Code wants a
 * list; these two functions are that mediation, in both directions.
 */
import type { Graph } from "./graph.js";

/** The ends a chain is made of: the owner's members, the owner's first, and each member's next. */
export interface ChainEnds {
  readonly members: string;
  readonly first: string;
  readonly next: string;
}

/** The members of `owner` in order, following first/next. Stops on a cycle. */
export function chain(graph: Graph, owner: string, ends: ChainEnds): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  let [current] = graph.navigate(owner, ends.first);
  while (current !== undefined && !seen.has(current)) {
    ordered.push(current);
    seen.add(current);
    [current] = graph.navigate(current, ends.next);
  }
  return ordered;
}

/** Makes `ids` the members of `owner`, in this order. */
export function setChain(graph: Graph, owner: string, ends: ChainEnds, ids: readonly string[]): void {
  for (const old of graph.navigate(owner, ends.members)) graph.disconnect(old, ends.next);
  graph.disconnect(owner, ends.members);
  graph.disconnect(owner, ends.first);
  ids.forEach((id, index) => {
    graph.connect(owner, ends.members, id);
    if (index === 0) graph.connect(owner, ends.first, id);
    else graph.connect(ids[index - 1]!, ends.next, id);
  });
}
