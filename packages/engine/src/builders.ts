import type {
  Action,
  Entity,
  EntityId,
  Interaction,
  Language,
  LanguageId,
  Layer,
  LayerId,
  Relationship,
  RelationshipConstraint,
  Transformation,
} from "./types.js";

function id(): string {
  return crypto.randomUUID();
}

function updateLayer(layers: Layer[], layerId: LayerId, fn: (layer: Layer) => Layer): Layer[] {
  return layers.map((layer) => (layer.id === layerId ? fn(layer) : layer));
}

function updateLanguage(
  layer: Layer,
  languageId: LanguageId,
  fn: (language: Language) => Language
): Layer {
  const language = layer.languages.get(languageId);
  if (!language) return layer;
  const languages = new Map(layer.languages);
  languages.set(languageId, fn(language));
  return { ...layer, languages };
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

export function createLayer(name: string): Layer {
  return {
    id: id(),
    name,
    languages: new Map(),
    transformations: new Map(),
    isPure: false,
  };
}

export function addLanguage(layers: Layer[], layerId: LayerId, name: string): Layer[] {
  const language: Language = { id: id(), name, entities: new Map(), interactions: new Map() };
  return updateLayer(layers, layerId, (layer) => {
    const languages = new Map(layer.languages);
    languages.set(language.id, language);
    return { ...layer, languages, isPure: languages.size === 1 };
  });
}

export function addEntity(
  layers: Layer[],
  layerId: LayerId,
  languageId: LanguageId,
  name: string
): Layer[] {
  const entity: Entity = { id: id(), name, languageId, relationships: [], actions: [] };
  return updateLayer(layers, layerId, (layer) =>
    updateLanguage(layer, languageId, (language) => {
      const entities = new Map(language.entities);
      entities.set(entity.id, entity);
      return { ...language, entities };
    })
  );
}

export function addRelationship(
  layers: Layer[],
  layerId: LayerId,
  languageId: LanguageId,
  entityId: EntityId,
  targetEntityId: EntityId,
  cardinality: [number, number],
  constraints: RelationshipConstraint[] = []
): Layer[] {
  const relationship: Relationship = { id: id(), targetEntityId, cardinality, constraints };
  return updateLayer(layers, layerId, (layer) =>
    updateLanguage(layer, languageId, (language) =>
      updateEntity(language, entityId, (entity) => ({
        ...entity,
        relationships: [...entity.relationships, relationship],
      }))
    )
  );
}

/** `languageId` is taken as given, not derived from the owning entity, so a
 *  caller (or a test) can construct an impure Action on purpose — purity is
 *  something the validator checks, not something the builder enforces. */
export function addAction(
  layers: Layer[],
  layerId: LayerId,
  languageId: LanguageId,
  entityId: EntityId,
  name: string,
  inputTypes: EntityId[],
  outputType: EntityId,
  actionLanguageId: LanguageId = languageId
): Layer[] {
  const action: Action = {
    id: id(),
    name,
    ownerEntityId: entityId,
    languageId: actionLanguageId,
    inputTypes,
    outputType,
  };
  return updateLayer(layers, layerId, (layer) =>
    updateLanguage(layer, languageId, (language) =>
      updateEntity(language, entityId, (entity) => ({
        ...entity,
        actions: [...entity.actions, action],
      }))
    )
  );
}

/** Stored under the language matching `inputLanguageId` — the language that
 *  initiates the interaction. */
export function addInteraction(
  layers: Layer[],
  layerId: LayerId,
  name: string,
  inputLanguageId: LanguageId,
  outputLanguageId: LanguageId,
  inputEntityIds: EntityId[],
  outputEntityId: EntityId
): Layer[] {
  const interaction: Interaction = {
    id: id(),
    name,
    inputLanguageId,
    outputLanguageId,
    inputEntityIds,
    outputEntityId,
    isPure: inputLanguageId === outputLanguageId,
  };
  return updateLayer(layers, layerId, (layer) =>
    updateLanguage(layer, inputLanguageId, (language) => {
      const interactions = new Map(language.interactions);
      interactions.set(interaction.id, interaction);
      return { ...language, interactions };
    })
  );
}

export function addTransformation(
  layers: Layer[],
  layerId: LayerId,
  sourceLanguageId: LanguageId,
  targetLanguageId: LanguageId,
  entityMappings: Transformation["entityMappings"] = [],
  interactionMappings: Transformation["interactionMappings"] = []
): Layer[] {
  const transformation: Transformation = {
    id: id(),
    sourceLanguageId,
    targetLanguageId,
    entityMappings,
    interactionMappings,
  };
  return updateLayer(layers, layerId, (layer) => {
    const transformations = new Map(layer.transformations);
    transformations.set(transformation.id, transformation);
    return { ...layer, transformations };
  });
}

/** Removes an entity and cascades within the same layer: relationships in
 *  other entities that target it, interactions that reference it (in any
 *  language of the layer), and transformation mappings that reference it. */
export function removeEntity(
  layers: Layer[],
  layerId: LayerId,
  languageId: LanguageId,
  entityId: EntityId
): Layer[] {
  return updateLayer(layers, layerId, (layer) => {
    const languages = new Map(
      Array.from(layer.languages.entries()).map(([langId, language]) => {
        const entities = new Map(
          Array.from(language.entities.entries())
            .filter(([eId]) => !(langId === languageId && eId === entityId))
            .map(([eId, entity]) => [
              eId,
              {
                ...entity,
                relationships: entity.relationships.filter(
                  (rel) => rel.targetEntityId !== entityId
                ),
              },
            ])
        );
        const interactions = new Map(
          Array.from(language.interactions.entries()).filter(
            ([, interaction]) =>
              !interaction.inputEntityIds.includes(entityId) &&
              interaction.outputEntityId !== entityId
          )
        );
        return [langId, { ...language, entities, interactions }];
      })
    );

    const transformations = new Map(
      Array.from(layer.transformations.entries()).map(([tId, transformation]) => [
        tId,
        {
          ...transformation,
          entityMappings: transformation.entityMappings.filter(
            (mapping) =>
              mapping.sourceId !== entityId &&
              !mapping.targetSubgraph.entityIds.includes(entityId)
          ),
        },
      ])
    );

    return { ...layer, languages, transformations };
  });
}
