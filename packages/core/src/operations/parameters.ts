/** An Interaction's Parameters are ordered by a first/next chain (Operations). */
import { chain, setChain, type ChainEnds } from "../kernel/chain.js";
import type { Graph } from "../kernel/graph.js";

const PARAMETERS: ChainEnds = { members: "parameters", first: "first", next: "next" };

/** The Parameters of an Interaction in order, following first/next. Stops on a cycle. */
export function parameters(graph: Graph, interaction: string): string[] {
  return chain(graph, interaction, PARAMETERS);
}

/** Makes `ids` the Interaction's Parameters, in this order. */
export function setParameters(graph: Graph, interaction: string, ids: readonly string[]): void {
  setChain(graph, interaction, PARAMETERS, ids);
}
