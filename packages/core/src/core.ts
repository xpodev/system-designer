/** The core vocabulary — Kernel, Contexts and Operations together — and graphs over it. */
import { coreSpec } from "./generated/schema.js";
import { Graph } from "./kernel/graph.js";
import { Vocabulary } from "./kernel/vocabulary.js";

export const coreVocabulary = new Vocabulary(coreSpec);

/** An empty model of the core Languages. */
export function coreGraph(): Graph {
  return new Graph(coreVocabulary);
}
