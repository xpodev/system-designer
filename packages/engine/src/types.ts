/**
 * The hypergraph AST. No dependency on rendering, storage, or a UI
 * framework — this file is the closed language the rest of the system talks
 * to only through explicit translation (the transport package, the app),
 * never by reaching into it.
 *
 * A Language is a top-level, shared resource: several Domains can reference
 * the same Language (a Domain does not own the Languages it uses). This is
 * why Language lives at the Project level, and Domain holds `languageIds`
 * (a set of references) rather than a `languages` map of owned values.
 */

export type DomainId = string;
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

// --- Language (a shared, top-level resource — see file header) ---

export interface Language {
  id: LanguageId;
  name: string;
  entities: Map<EntityId, Entity>;
  interactions: Map<InteractionId, Interaction>;
}

// --- Domain (formerly "Layer") ---

export interface Domain {
  id: DomainId;
  name: string;
  /** References into Project.languages — a Domain does not own these.
   *  The same Language can be referenced by more than one Domain. */
  languageIds: Set<LanguageId>;
  transformations: Map<TransformationId, Transformation>;
  /** languageIds.size === 1 */
  isPure: boolean;
}

// --- Mediation Stack Expression (A / M) ---

export interface MediationNode {
  id: string;
  intentDomainId: DomainId;
  mediatorDomainId: DomainId;
  /** Holds the tau mappings. */
  implementationDomainId: DomainId;
}

/** The persisted whole. Languages are stored once, at the top level;
 *  Domains reference them by id. */
export interface Project {
  languages: Map<LanguageId, Language>;
  domains: Domain[];
  mediations: MediationNode[];
}
