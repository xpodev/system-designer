/** What Operations owns: a Language its Interactions, an Interaction its Parameters, a Transformation its Interaction mappings. */
import { composition } from "../kernel/removal.js";

export const operationsComposition = composition(
  {
    Language: ["interactions"],
    Interaction: ["parameters"],
    Transformation: ["interactionMappings"],
  },
  ["InteractionMapping"],
);
