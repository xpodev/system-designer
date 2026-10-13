/** The core vocabulary — every core layer together — and graphs over it. */
import { contextsComposition } from "./contexts/composition.js";
import { deploymentComposition } from "./deployment/composition.js";
import { functionsComposition } from "./functions/composition.js";
import { coreSpec } from "./generated/schema.js";
import { copyInto } from "./kernel/copy.js";
import { Graph } from "./kernel/graph.js";
import { compose, kernelComposition, removeAll } from "./kernel/removal.js";
import { Vocabulary } from "./kernel/vocabulary.js";
import { mediationComposition } from "./mediation/composition.js";
import { systemsComposition } from "./systems/composition.js";

/** The vocabulary a System is a model of: the six core Languages together. */
export const coreVocabulary = new Vocabulary(coreSpec);

/** An empty model of the core Languages. */
export function coreGraph(): Graph {
  return new Graph(coreVocabulary);
}

/** What every layer owns, what depends on what, and what each thing requires. */
export const systemComposition = compose(
  kernelComposition,
  functionsComposition,
  contextsComposition,
  deploymentComposition,
  mediationComposition,
  systemsComposition,
);

/** Removes `ids` and everything the foundation says goes with them; returns every removed id. */
export function remove(graph: Graph, ...ids: string[]): string[] {
  return removeAll(graph, ids, systemComposition);
}

/** Copies `roots`, with everything they own, from `source` into `target` (see `copyInto`). */
export function copy(source: Graph, target: Graph, roots: readonly string[], copied = new Map<string, string>()): string[] {
  return copyInto(source, target, roots, systemComposition, copied);
}
