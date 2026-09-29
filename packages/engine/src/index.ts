export type {
  DomainId,
  LanguageId,
  EntityId,
  InteractionId,
  TransformationId,
  RelationshipConstraint,
  Relationship,
  Action,
  Entity,
  Interaction,
  TauMapping,
  Transformation,
  Language,
  Domain,
  MediationNode,
  Project,
} from "./types.js";

export {
  createDomain,
  createLanguage,
  referenceLanguage,
  unreferenceLanguage,
  addLanguage,
  addEntity,
  addRelationship,
  addAction,
  addInteraction,
  addTransformation,
  removeEntity,
  removeRelationship,
  removeAction,
  removeInteraction,
  removeTransformation,
  removeDomain,
  removeLanguage,
} from "./builders.js";

export { addMediation, removeMediation } from "./mediation.js";

export type { Finding } from "./validation.js";
export {
  checkActionPurity,
  checkInteractionAlignment,
  checkTauCompleteness,
  checkRelationshipCardinality,
  checkRelationshipConstraints,
  validateProject,
} from "./validation.js";

export { PredicateError, evaluatePredicate } from "./predicate.js";

export { isUnboundedMax, formatCardinalityBound, formatCardinality } from "./cardinality.js";
