import { PredicateError, evaluatePredicate } from "./predicate.js";
import type { Entity, Language, Layer } from "./types.js";

export interface Finding {
  kind: "action-purity" | "interaction-alignment" | "tau-incompleteness" | "cardinality";
  severity: "error" | "warning";
  message: string;
  layerId: string;
  languageId?: string;
  entityId?: string;
  refId?: string;
}

function allEntities(layer: Layer): { language: Language; entity: Entity }[] {
  return Array.from(layer.languages.values()).flatMap((language) =>
    Array.from(language.entities.values()).map((entity) => ({ language, entity }))
  );
}

function findEntityLanguage(layer: Layer, entityId: string): Language | undefined {
  return Array.from(layer.languages.values()).find((language) => language.entities.has(entityId));
}

/** Spec §7, check 1: an Action's input/output types must live in the same
 *  language as the Action itself — "Action '[Name]' on Entity '[E]' leaks
 *  type from external language." */
export function checkActionPurity(layers: Layer[]): Finding[] {
  const findings: Finding[] = [];
  for (const layer of layers) {
    for (const { entity } of allEntities(layer)) {
      for (const action of entity.actions) {
        const referencedIds = [...action.inputTypes, action.outputType];
        for (const refId of referencedIds) {
          const refLanguage = findEntityLanguage(layer, refId);
          if (refLanguage && refLanguage.id !== action.languageId) {
            findings.push({
              kind: "action-purity",
              severity: "error",
              message: `Action '${action.name}' on Entity '${entity.name}' leaks type from external language.`,
              layerId: layer.id,
              languageId: action.languageId,
              entityId: entity.id,
              refId: action.id,
            });
          }
        }
      }
    }
  }
  return findings;
}

/** Spec §7, check 2: an Interaction's input/output languages must both exist
 *  in the containing Layer — "Interaction '[Name]' references language
 *  outside containing layer." */
export function checkInteractionAlignment(layers: Layer[]): Finding[] {
  const findings: Finding[] = [];
  for (const layer of layers) {
    for (const language of layer.languages.values()) {
      for (const interaction of language.interactions.values()) {
        const misaligned =
          !layer.languages.has(interaction.inputLanguageId) ||
          !layer.languages.has(interaction.outputLanguageId);
        if (misaligned) {
          findings.push({
            kind: "interaction-alignment",
            severity: "error",
            message: `Interaction '${interaction.name}' references language outside containing layer.`,
            layerId: layer.id,
            languageId: language.id,
            refId: interaction.id,
          });
        }
      }
    }
  }
  return findings;
}

/** Spec §7, check 3: every entity in a Transformation's source language
 *  should have a mapping — "Unmapped intent entity '[E]' in translation
 *  layer." (warning, not an error). */
export function checkTauCompleteness(layers: Layer[]): Finding[] {
  const findings: Finding[] = [];
  for (const layer of layers) {
    for (const transformation of layer.transformations.values()) {
      const sourceLanguage = layer.languages.get(transformation.sourceLanguageId);
      if (!sourceLanguage) continue;
      const mappedIds = new Set(transformation.entityMappings.map((m) => m.sourceId));
      for (const entity of sourceLanguage.entities.values()) {
        if (!mappedIds.has(entity.id)) {
          findings.push({
            kind: "tau-incompleteness",
            severity: "warning",
            message: `Unmapped intent entity '${entity.name}' in translation layer.`,
            layerId: layer.id,
            languageId: sourceLanguage.id,
            entityId: entity.id,
            refId: transformation.id,
          });
        }
      }
    }
  }
  return findings;
}

/** Spec §7, check 4: a Relationship's [N, M] cardinality bound must be
 *  well-formed (0 <= N <= M). Evaluating the predicate `constraints`
 *  expressions against actual graph instantiations needs an expression
 *  evaluator that doesn't exist yet — documented extension point, not built
 *  in v1. */
export function checkRelationshipCardinality(layers: Layer[]): Finding[] {
  const findings: Finding[] = [];
  for (const layer of layers) {
    for (const { entity } of allEntities(layer)) {
      for (const relationship of entity.relationships) {
        const [min, max] = relationship.cardinality;
        if (min < 0 || min > max) {
          findings.push({
            kind: "cardinality",
            severity: "error",
            message: `Relationship on Entity '${entity.name}' has an invalid cardinality bound [${min}, ${max}].`,
            layerId: layer.id,
            entityId: entity.id,
            refId: relationship.id,
          });
        }
      }
    }
  }
  return findings;
}

/** Spec §7, check 4 (predicate half): evaluates each Relationship's
 *  `constraints` expressions against `{ self: <owning entity>, child: <entity
 *  at targetEntityId> }`. A malformed expression or unresolvable property
 *  path is an error naming the problem; an expression that evaluates cleanly
 *  to false is an error naming the violated constraint. */
export function checkRelationshipConstraints(layers: Layer[]): Finding[] {
  const findings: Finding[] = [];
  for (const layer of layers) {
    for (const { entity: self } of allEntities(layer)) {
      for (const relationship of self.relationships) {
        const childLanguage = findEntityLanguage(layer, relationship.targetEntityId);
        const child = childLanguage?.entities.get(relationship.targetEntityId);
        if (!child) continue;

        for (const constraint of relationship.constraints) {
          try {
            const holds = evaluatePredicate(constraint.expression, { self, child });
            if (!holds) {
              findings.push({
                kind: "cardinality",
                severity: "error",
                message: `Relationship constraint on Entity '${self.name}' violated: ${constraint.expression}`,
                layerId: layer.id,
                entityId: self.id,
                refId: relationship.id,
              });
            }
          } catch (err) {
            const reason = err instanceof PredicateError ? err.message : String(err);
            findings.push({
              kind: "cardinality",
              severity: "error",
              message: `Relationship constraint on Entity '${self.name}' failed to evaluate: ${reason}`,
              layerId: layer.id,
              entityId: self.id,
              refId: relationship.id,
            });
          }
        }
      }
    }
  }
  return findings;
}

export function validateLayers(layers: Layer[]): Finding[] {
  return [
    ...checkActionPurity(layers),
    ...checkInteractionAlignment(layers),
    ...checkTauCompleteness(layers),
    ...checkRelationshipCardinality(layers),
    ...checkRelationshipConstraints(layers),
  ];
}
