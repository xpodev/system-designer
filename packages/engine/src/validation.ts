import { formatCardinality, isUnboundedMax } from "./cardinality.js";
import { PredicateError, evaluatePredicate } from "./predicate.js";
import type { Entity, Language, Project } from "./types.js";

export interface Finding {
  kind: "action-purity" | "interaction-alignment" | "tau-incompleteness" | "cardinality";
  severity: "error" | "warning";
  message: string;
  languageId?: string;
  entityId?: string;
  domainId?: string;
  refId?: string;
}

function allEntities(project: Project): { language: Language; entity: Entity }[] {
  return Array.from(project.languages.values()).flatMap((language) =>
    Array.from(language.entities.values()).map((entity) => ({ language, entity }))
  );
}

function findEntityLanguage(project: Project, entityId: string): Language | undefined {
  return Array.from(project.languages.values()).find((language) => language.entities.has(entityId));
}

/** Spec §7, check 1: an Action's input/output types must live in the same
 *  language as the Action itself — a purely Language-scoped rule, so it
 *  doesn't need a Domain at all. "Action '[Name]' on Entity '[E]' leaks
 *  type from external language." */
export function checkActionPurity(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const { entity } of allEntities(project)) {
    for (const action of entity.actions) {
      const referencedIds = [...action.inputTypes, action.outputType];
      for (const refId of referencedIds) {
        const refLanguage = findEntityLanguage(project, refId);
        if (refLanguage && refLanguage.id !== action.languageId) {
          findings.push({
            kind: "action-purity",
            severity: "error",
            message: `Action '${action.name}' on Entity '${entity.name}' leaks type from external language.`,
            languageId: action.languageId,
            entityId: entity.id,
            refId: action.id,
          });
        }
      }
    }
  }
  return findings;
}

/** Spec §7, check 2, adapted for reference-not-own Domains: since a Domain no
 *  longer "contains" the languages it uses, "outside the containing layer"
 *  becomes "the two languages share no common domain" — the closest
 *  equivalent of the original rule once languages are shared, top-level
 *  resources. "Interaction 'X' references languages with no common domain." */
export function checkInteractionAlignment(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const language of project.languages.values()) {
    for (const interaction of language.interactions.values()) {
      const bothExist =
        project.languages.has(interaction.inputLanguageId) &&
        project.languages.has(interaction.outputLanguageId);
      const sharedDomain = project.domains.some(
        (domain) =>
          domain.languageIds.has(interaction.inputLanguageId) &&
          domain.languageIds.has(interaction.outputLanguageId)
      );
      if (!bothExist || !sharedDomain) {
        findings.push({
          kind: "interaction-alignment",
          severity: "error",
          message: `Interaction '${interaction.name}' references languages with no common domain.`,
          languageId: language.id,
          refId: interaction.id,
        });
      }
    }
  }
  return findings;
}

/** Spec §7, check 3: every entity in a Transformation's source language
 *  should have a mapping — "Unmapped intent entity '[E]' in translation
 *  domain." (warning, not an error). A Transformation belongs to the Domain
 *  that implements it, so this one stays Domain-scoped. */
export function checkTauCompleteness(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const domain of project.domains) {
    for (const transformation of domain.transformations.values()) {
      const sourceLanguage = project.languages.get(transformation.sourceLanguageId);
      if (!sourceLanguage) continue;
      const mappedIds = new Set(transformation.entityMappings.map((m) => m.sourceId));
      for (const entity of sourceLanguage.entities.values()) {
        if (!mappedIds.has(entity.id)) {
          findings.push({
            kind: "tau-incompleteness",
            severity: "warning",
            message: `Unmapped intent entity '${entity.name}' in translation domain.`,
            domainId: domain.id,
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
 *  well-formed (0 <= N, and N <= M unless M is the "unbounded" sentinel — see
 *  cardinality.ts). Purely Language/Entity-scoped, no Domain needed.
 *  Evaluating the predicate `constraints` expressions against actual graph
 *  instantiations needs an expression evaluator that doesn't exist yet —
 *  documented extension point, not built in v1. */
export function checkRelationshipCardinality(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const { entity } of allEntities(project)) {
    for (const relationship of entity.relationships) {
      const [min, max] = relationship.cardinality;
      if (min < 0 || (!isUnboundedMax(max) && min > max)) {
        findings.push({
          kind: "cardinality",
          severity: "error",
          message: `Relationship on Entity '${entity.name}' has an invalid cardinality bound ${formatCardinality(relationship.cardinality)}.`,
          entityId: entity.id,
          refId: relationship.id,
        });
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
export function checkRelationshipConstraints(project: Project): Finding[] {
  const findings: Finding[] = [];
  for (const { entity: self } of allEntities(project)) {
    for (const relationship of self.relationships) {
      const childLanguage = findEntityLanguage(project, relationship.targetEntityId);
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
            entityId: self.id,
            refId: relationship.id,
          });
        }
      }
    }
  }
  return findings;
}

export function validateProject(project: Project): Finding[] {
  return [
    ...checkActionPurity(project),
    ...checkInteractionAlignment(project),
    ...checkTauCompleteness(project),
    ...checkRelationshipCardinality(project),
    ...checkRelationshipConstraints(project),
  ];
}
