import type {
  Action,
  Domain,
  DomainId,
  Entity,
  EntityId,
  Interaction,
  Language,
  LanguageId,
  Project,
  Relationship,
  RelationshipConstraint,
  Transformation,
} from "./types.js";

function id(): string {
  return crypto.randomUUID();
}

export function createDomain(name: string): Domain {
  return {
    id: id(),
    name,
    languageIds: new Set(),
    transformations: new Map(),
    isPure: false,
  };
}

function updateDomain(project: Project, domainId: DomainId, fn: (domain: Domain) => Domain): Project {
  return { ...project, domains: project.domains.map((d) => (d.id === domainId ? fn(d) : d)) };
}

function updateLanguage(
  project: Project,
  languageId: LanguageId,
  fn: (language: Language) => Language
): Project {
  const language = project.languages.get(languageId);
  if (!language) return project;
  const languages = new Map(project.languages);
  languages.set(languageId, fn(language));
  return { ...project, languages };
}

function updateEntity(
  language: Language,
  entityId: EntityId,
  fn: (entity: Entity) => Entity
): Language {
  const entity = language.entities.get(entityId);
  if (!entity) return language;
  const entities = new Map(language.entities);
  entities.set(entityId, fn(entity));
  return { ...language, entities };
}

/** Creates a new Language, unreferenced by any Domain. */
export function createLanguage(project: Project, name: string): Project {
  const language: Language = { id: id(), name, entities: new Map(), interactions: new Map() };
  const languages = new Map(project.languages);
  languages.set(language.id, language);
  return { ...project, languages };
}

/** References an EXISTING Language into a Domain — the operation that lets
 *  several Domains share one Language. */
export function referenceLanguage(project: Project, domainId: DomainId, languageId: LanguageId): Project {
  return updateDomain(project, domainId, (domain) => {
    const languageIds = new Set(domain.languageIds);
    languageIds.add(languageId);
    return { ...domain, languageIds, isPure: languageIds.size === 1 };
  });
}

export function unreferenceLanguage(project: Project, domainId: DomainId, languageId: LanguageId): Project {
  return updateDomain(project, domainId, (domain) => {
    const languageIds = new Set(domain.languageIds);
    languageIds.delete(languageId);
    return { ...domain, languageIds, isPure: languageIds.size === 1 };
  });
}

/** Convenience: create a new Language and reference it into `domainId` in
 *  one step — the common case of "add a language to this domain". To reuse
 *  an existing Language in another domain, use `referenceLanguage` instead. */
export function addLanguage(project: Project, domainId: DomainId, name: string): Project {
  const language: Language = { id: id(), name, entities: new Map(), interactions: new Map() };
  const languages = new Map(project.languages);
  languages.set(language.id, language);
  const withLanguage = { ...project, languages };
  return referenceLanguage(withLanguage, domainId, language.id);
}

export function addEntity(project: Project, languageId: LanguageId, name: string): Project {
  const entity: Entity = { id: id(), name, languageId, relationships: [], actions: [] };
  return updateLanguage(project, languageId, (language) => {
    const entities = new Map(language.entities);
    entities.set(entity.id, entity);
    return { ...language, entities };
  });
}

export function addRelationship(
  project: Project,
  languageId: LanguageId,
  entityId: EntityId,
  targetEntityId: EntityId,
  cardinality: [number, number],
  constraints: RelationshipConstraint[] = []
): Project {
  const relationship: Relationship = { id: id(), targetEntityId, cardinality, constraints };
  return updateLanguage(project, languageId, (language) =>
    updateEntity(language, entityId, (entity) => ({
      ...entity,
      relationships: [...entity.relationships, relationship],
    }))
  );
}

/** `languageId` is taken as given, not derived from the owning entity, so a
 *  caller (or a test) can construct an impure Action on purpose — purity is
 *  something the validator checks, not something the builder enforces. */
export function addAction(
  project: Project,
  languageId: LanguageId,
  entityId: EntityId,
  name: string,
  inputTypes: EntityId[],
  outputType: EntityId,
  actionLanguageId: LanguageId = languageId
): Project {
  const action: Action = {
    id: id(),
    name,
    ownerEntityId: entityId,
    languageId: actionLanguageId,
    inputTypes,
    outputType,
  };
  return updateLanguage(project, languageId, (language) =>
    updateEntity(language, entityId, (entity) => ({
      ...entity,
      actions: [...entity.actions, action],
    }))
  );
}

/** Stored under the language matching `inputLanguageId` — the language that
 *  initiates the interaction. */
export function addInteraction(
  project: Project,
  name: string,
  inputLanguageId: LanguageId,
  outputLanguageId: LanguageId,
  inputEntityIds: EntityId[],
  outputEntityId: EntityId
): Project {
  const interaction: Interaction = {
    id: id(),
    name,
    inputLanguageId,
    outputLanguageId,
    inputEntityIds,
    outputEntityId,
    isPure: inputLanguageId === outputLanguageId,
  };
  return updateLanguage(project, inputLanguageId, (language) => {
    const interactions = new Map(language.interactions);
    interactions.set(interaction.id, interaction);
    return { ...language, interactions };
  });
}

/** A Transformation belongs to the Domain that implements it (the "impl
 *  layer" holding the tau mappings), not to either Language it connects. */
export function addTransformation(
  project: Project,
  domainId: DomainId,
  sourceLanguageId: LanguageId,
  targetLanguageId: LanguageId,
  entityMappings: Transformation["entityMappings"] = [],
  interactionMappings: Transformation["interactionMappings"] = []
): Project {
  const transformation: Transformation = {
    id: id(),
    sourceLanguageId,
    targetLanguageId,
    entityMappings,
    interactionMappings,
  };
  return updateDomain(project, domainId, (domain) => {
    const transformations = new Map(domain.transformations);
    transformations.set(transformation.id, transformation);
    return { ...domain, transformations };
  });
}

/** Removes an entity and cascades across the whole project (Languages are
 *  shared, so a reference to this entity could be anywhere): relationships
 *  in other entities that target it (any language), interactions that
 *  reference it (any language), and transformation mappings that reference
 *  it (any domain). */
export function removeEntity(project: Project, languageId: LanguageId, entityId: EntityId): Project {
  const languages = new Map(
    Array.from(project.languages.entries()).map(([langId, language]) => {
      const entities = new Map(
        Array.from(language.entities.entries())
          .filter(([eId]) => !(langId === languageId && eId === entityId))
          .map(([eId, entity]) => [
            eId,
            {
              ...entity,
              relationships: entity.relationships.filter((rel) => rel.targetEntityId !== entityId),
            },
          ])
      );
      const interactions = new Map(
        Array.from(language.interactions.entries()).filter(
          ([, interaction]) =>
            !interaction.inputEntityIds.includes(entityId) && interaction.outputEntityId !== entityId
        )
      );
      return [langId, { ...language, entities, interactions }];
    })
  );

  const domains = project.domains.map((domain) => ({
    ...domain,
    transformations: new Map(
      Array.from(domain.transformations.entries()).map(([tId, transformation]) => [
        tId,
        {
          ...transformation,
          entityMappings: transformation.entityMappings.filter(
            (mapping) =>
              mapping.sourceId !== entityId && !mapping.targetSubgraph.entityIds.includes(entityId)
          ),
        },
      ])
    ),
  }));

  return { ...project, languages, domains };
}
