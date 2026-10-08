/** Mediums in scope, and a Connection's stack of Mediations, in order. */
import { access, importable } from "../contexts/scope.js";
import { chain, setChain, type ChainEnds } from "../kernel/chain.js";
import type { Graph } from "../kernel/graph.js";

const STACK: ChainEnds = { members: "mediations", first: "first", next: "next" };

/** The Mediums a Component may import. */
export function importableMediums(graph: Graph, component: string): string[] {
  return importable(graph, component, "mediums", "importedMediums");
}

/** The Mediums a Component has access to, and so may mediate its Deployments' Connections over. */
export function accessibleMediums(graph: Graph, component: string): string[] {
  return access(graph, component, "mediums", "importedMediums");
}

/** A Connection's Mediations, from the first — over its What — down. */
export function mediationStack(graph: Graph, connection: string): string[] {
  return chain(graph, connection, STACK);
}

/** Makes `ids` the Connection's Mediations, in this order. */
export function setMediationStack(graph: Graph, connection: string, ids: readonly string[]): void {
  setChain(graph, connection, STACK, ids);
}
