/** What Functions owns: a Function its Parameters, each of which exists only while its type does. */
import { composition } from "../kernel/removal.js";

export const functionsComposition = composition(
  {
    Interaction: ["parameters"],
    Transformation: ["parameters"],
  },
  [],
  { Parameter: [["type"]] },
);
