/** The core vocabulary — Kernel, Contexts and Operations together — Std on top, and graphs over them. */
import { contextsComposition } from "./contexts/composition.js";
import { removeWithScope } from "./contexts/deletion.js";
import { coreSpec, stdSpec } from "./generated/schema.js";
import { Graph } from "./kernel/graph.js";
import { compose, kernelComposition } from "./kernel/removal.js";
import { Vocabulary } from "./kernel/vocabulary.js";
import { operationsComposition } from "./operations/composition.js";
import { stdComposition } from "./std/composition.js";

export const coreVocabulary = new Vocabulary(coreSpec);

/** The vocabulary a System is kept in: the core, with Std on top. */
export const systemVocabulary = new Vocabulary(stdSpec);

/** An empty model of the core Languages. */
export function coreGraph(): Graph {
  return new Graph(coreVocabulary);
}

/** An empty System model: the core Languages and Std. */
export function systemGraph(): Graph {
  return new Graph(systemVocabulary);
}

/** What every layer owns, and what depends on what. */
export const systemComposition = compose(kernelComposition, contextsComposition, operationsComposition, stdComposition);

/** Removes `ids` and everything the foundation says goes with them; returns every removed id. */
export function remove(graph: Graph, ...ids: string[]): string[] {
  return removeWithScope(graph, ids, systemComposition);
}
