/** Mediums in scope, and a Connection's stack of Mediations, in order. */
import { access } from "../contexts/scope.js";
import { chain, setChain, type ChainEnds } from "../kernel/chain.js";
import type { Graph } from "../kernel/graph.js";

const STACK: ChainEnds = { members: "mediations", previous: "above", next: "below" };

/** The Mediums a Component has access to, and so may mediate its Deployments' Connections over. */
export function accessibleMediums(graph: Graph, component: string): string[] {
  return access(graph, component, "mediums", "Medium");
}

/** A Connection's Mediations, from the top — over its What — down. */
export function mediationStack(graph: Graph, connection: string): string[] {
  return chain(graph, connection, STACK);
}

/** Makes `ids` the Connection's Mediations, in this order. */
export function setMediationStack(graph: Graph, connection: string, ids: readonly string[]): void {
  setChain(graph, connection, STACK, ids);
}
