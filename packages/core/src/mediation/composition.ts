/**
 * What Mediation owns: a Component the Mediums it defines, a Connection its Mediations. A
 * Mediation never goes with its Medium or its realization: without them it stays, broken or
 * unrealized, until it is fixed (docs/foundation.md, *Mediation*). An Export exists only while
 * what it exports does — said here, where a Medium is the last thing it can export.
 */
import { composition } from "../kernel/removal.js";

export const mediationComposition = composition(
  {
    Component: ["mediums"],
    Connection: ["mediations"],
  },
  [],
  { Export: [["component", "interaction", "transformation", "language", "medium", "deployment", "instance"]] },
);
