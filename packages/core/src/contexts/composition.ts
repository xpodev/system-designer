/**
 * What Contexts owns, and what depends on what it refers to: a System its top-level
 * Components, a Component its children, Languages and Transformations, a Transformation its
 * mappings. A mapping exists only while what it maps does; a Transformation only while both
 * its Languages do.
 */
import { composition } from "../kernel/removal.js";

export const contextsComposition = composition(
  {
    System: ["components"],
    Component: ["components", "languages", "transformations"],
    Transformation: ["entityMappings", "relationshipMappings"],
  },
  ["EntityMapping", "RelationshipMapping"],
  { Transformation: [["source"], ["target"]] },
);
