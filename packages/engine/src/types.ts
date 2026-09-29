/**
 * The hypergraph AST. Kept close to the spec's own shapes. No dependency on
 * rendering, storage, or a UI framework — this is the closed language the rest
 * of the system talks to only through explicit translation (the transport
 * package, the app), never by reaching into it.
 */

export type LayerId = string;
export type LanguageId = string;
export type EntityId = string;
export type InteractionId = string;
export type TransformationId = string;

// --- Entity & Actions ---

export interface RelationshipConstraint {
  id: string;
  /** First-order predicate, e.g. "(child.parent == self)". Evaluating this is
   *  a documented extension point — v1's validator checks cardinality only. */
  expression: string;
}

export interface Relationship {
  id: string;
  targetEntityId: EntityId;
  /** [min, max] */
  cardinality: [number, number];
  constraints: RelationshipConstraint[];
}

export interface Action {
  id: string;
  name: string;
  ownerEntityId: EntityId;
  /** Pure: must equal the owning Entity's languageId. */
  languageId: LanguageId;
  inputTypes: EntityId[];
  outputType: EntityId;
}

export interface Entity {
  id: EntityId;
  name: string;
  languageId: LanguageId;
  relationships: Relationship[];
  actions: Action[];
}

// --- Interactions ---

export interface Interaction {
  id: InteractionId;
  name: string;
  inputLanguageId: LanguageId;
  outputLanguageId: LanguageId;
  inputEntityIds: EntityId[];
  outputEntityId: EntityId;
  /** inputLanguageId === outputLanguageId */
  isPure: boolean;
}

// --- Transformation (tau) ---

export interface TauMapping<TSource, TTarget> {
  sourceId: TSource;
  targetSubgraph: {
    entityIds: EntityId[];
    interactionIds: InteractionId[];
  };
}

export interface Transformation {
  id: TransformationId;
  sourceLanguageId: LanguageId;
  targetLanguageId: LanguageId;
  entityMappings: TauMapping<EntityId, EntityId>[];
  interactionMappings: TauMapping<InteractionId, InteractionId>[];
}

// --- Language & Layer ---

export interface Language {
  id: LanguageId;
  name: string;
  entities: Map<EntityId, Entity>;
  interactions: Map<InteractionId, Interaction>;
}

export interface Layer {
  id: LayerId;
  name: string;
  languages: Map<LanguageId, Language>;
  transformations: Map<TransformationId, Transformation>;
  /** languages.size === 1 */
  isPure: boolean;
}

// --- Mediation Stack Expression (A / M) ---

export interface MediationNode {
  id: string;
  intentLayerId: LayerId;
  mediatorLayerId: LayerId;
  /** Holds the tau mappings. */
  implementationLayerId: LayerId;
}

/**
 * The persisted whole. The spec's IStorageTransport signature was drafted
 * around bare `Layer[]`, before MediationNode had anywhere to live — a
 * Project is the minimal extension that gives A/M mediation stacks a place
 * to be stored and round-tripped, without touching Layer itself.
 */
export interface Project {
  layers: Layer[];
  mediations: MediationNode[];
}
