/**
 * What Contexts owns, and what depends on what it refers to: a Transformation exists only while
 * its Languages do, a mapping only while what it maps does, a Mediation only while its three
 * Domains do.
 */
import { composition } from "../kernel/removal.js";

export const contextsComposition = composition(
  {
    System: ["languages", "domains", "mediations"],
    Domain: ["transformations"],
    Transformation: ["reverse", "entityMappings", "relationshipMappings"],
  },
  ["Transformation", "EntityMapping", "RelationshipMapping", "Mediation"],
);
