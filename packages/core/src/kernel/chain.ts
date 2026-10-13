/**
 * An ordered collection, in the kernel's terms: members linked from their owner, ordered by a
 * chain of previous/next links among them (a Function's Parameters, a Connection's
 * Mediations); the first is the one nothing precedes. Code wants a list; these two functions
 * are that mediation, in both directions.
 */
import type { Graph } from "./graph.js";

/** The ends a chain is made of: the owner's members, and each member's previous and next. */
export interface ChainEnds {
  readonly members: string;
  readonly previous: string;
  readonly next: string;
}

/**
 * The members of `owner` in order: from each that no member precedes, along next. Members a
 * broken chain leaves out come after, in link order. Stops on a cycle.
 */
export function chain(graph: Graph, owner: string, ends: ChainEnds): string[] {
  const members = graph.navigate(owner, ends.members);
  const among = new Set(members);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const head of members) {
    const [previous] = graph.navigate(head, ends.previous);
    if (previous !== undefined && among.has(previous)) continue;
    let current: string | undefined = head;
    while (current !== undefined && among.has(current) && !seen.has(current)) {
      ordered.push(current);
      seen.add(current);
      [current] = graph.navigate(current, ends.next);
    }
  }
  return [...ordered, ...members.filter((member) => !seen.has(member))];
}

/** Makes `ids` the members of `owner`, in this order. */
export function setChain(graph: Graph, owner: string, ends: ChainEnds, ids: readonly string[]): void {
  for (const old of graph.navigate(owner, ends.members)) graph.disconnect(old, ends.next);
  graph.disconnect(owner, ends.members);
  ids.forEach((id, index) => {
    graph.disconnect(id, ends.next);
    graph.connect(owner, ends.members, id);
    if (index > 0) graph.connect(ids[index - 1]!, ends.next, id);
  });
}
