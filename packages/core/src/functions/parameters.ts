/** A Function's Parameters are ordered by a previous/next chain (Functions). */
import { chain, setChain, type ChainEnds } from "../kernel/chain.js";
import type { Graph } from "../kernel/graph.js";

const PARAMETERS: ChainEnds = { members: "parameters", previous: "previous", next: "next" };

/** The Parameters of a Function — an Interaction or a Transformation — in order. */
export function parameters(graph: Graph, func: string): string[] {
  return chain(graph, func, PARAMETERS);
}

/** Makes `ids` the Function's Parameters, in this order. */
export function setParameters(graph: Graph, func: string, ids: readonly string[]): void {
  setChain(graph, func, PARAMETERS, ids);
}
