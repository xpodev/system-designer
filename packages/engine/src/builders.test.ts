import { describe, expect, it } from "vitest";
import {
  addAction,
  addEntity,
  addInteraction,
  addLanguage,
  addRelationship,
  addTransformation,
  createDomain,
  referenceLanguage,
  removeAction,
  removeDomain,
  removeEntity,
  removeInteraction,
  removeLanguage,
  removeRelationship,
  removeTransformation,
  unreferenceLanguage,
} from "./builders.js";
import { addMediation } from "./mediation.js";
import type { Project } from "./types.js";

function emptyProject(): Project {
  return { languages: new Map(), domains: [], mediations: [] };
}

describe("builders", () => {
  it("createDomain starts empty and impure (no languages referenced yet)", () => {
    const domain = createDomain("Tycoon Domain");
    expect(domain.languageIds.size).toBe(0);
    expect(domain.isPure).toBe(false);
  });

  it("addLanguage does not mutate the input project", () => {
    const domain = createDomain("Tycoon Domain");
    const before: Project = { ...emptyProject(), domains: [domain] };
    const snapshotSize = before.languages.size;

    const after = addLanguage(before, domain.id, "Tycoon");

    expect(before.languages.size).toBe(snapshotSize);
    expect(after.languages.size).toBe(1);
    expect(after.domains[0].languageIds.size).toBe(1);
    expect(after.domains[0].isPure).toBe(true);
  });

  it("the same language can be referenced by two domains", () => {
    const domainA = createDomain("A");
    const domainB = createDomain("B");
    let project: Project = { ...emptyProject(), domains: [domainA, domainB] };
    project = addLanguage(project, domainA.id, "Shared");
    const languageId = Array.from(project.languages.keys())[0];

    project = referenceLanguage(project, domainB.id, languageId);

    expect(project.languages.size).toBe(1);
    expect(project.domains[0].languageIds.has(languageId)).toBe(true);
    expect(project.domains[1].languageIds.has(languageId)).toBe(true);
  });

  it("unreferenceLanguage removes the reference without deleting the language", () => {
    const domainA = createDomain("A");
    const domainB = createDomain("B");
    let project: Project = { ...emptyProject(), domains: [domainA, domainB] };
    project = addLanguage(project, domainA.id, "Shared");
    const languageId = Array.from(project.languages.keys())[0];
    project = referenceLanguage(project, domainB.id, languageId);

    project = unreferenceLanguage(project, domainA.id, languageId);

    expect(project.domains[0].languageIds.has(languageId)).toBe(false);
    expect(project.domains[1].languageIds.has(languageId)).toBe(true);
    expect(project.languages.has(languageId)).toBe(true);
  });

  it("addEntity does not mutate the input project", () => {
    const domain = createDomain("Tycoon Domain");
    let project: Project = { ...emptyProject(), domains: [domain] };
    project = addLanguage(project, domain.id, "Tycoon");
    const languageId = Array.from(project.languages.keys())[0];
    const before = project;

    const after = addEntity(before, languageId, "Park");

    expect(before.languages.get(languageId)!.entities.size).toBe(0);
    expect(after.languages.get(languageId)!.entities.size).toBe(1);
  });

  it("removeEntity cascades to relationships that target it, across languages", () => {
    const domain = createDomain("Tycoon Domain");
    let project: Project = { ...emptyProject(), domains: [domain] };
    project = addLanguage(project, domain.id, "Tycoon");
    const languageId = Array.from(project.languages.keys())[0];
    project = addEntity(project, languageId, "Park");
    project = addEntity(project, languageId, "Guest");
    const [parkId, guestId] = Array.from(project.languages.get(languageId)!.entities.keys());
    project = addRelationship(project, languageId, parkId, guestId, [0, 1000]);

    project = removeEntity(project, languageId, guestId);

    const language = project.languages.get(languageId)!;
    expect(language.entities.has(guestId)).toBe(false);
    expect(language.entities.get(parkId)!.relationships).toHaveLength(0);
  });

  it("removeRelationship removes only the matching relationship", () => {
    const domain = createDomain("Tycoon Domain");
    let project: Project = { ...emptyProject(), domains: [domain] };
    project = addLanguage(project, domain.id, "Tycoon");
    const languageId = Array.from(project.languages.keys())[0];
    project = addEntity(project, languageId, "Park");
    project = addEntity(project, languageId, "Guest");
    const [parkId, guestId] = Array.from(project.languages.get(languageId)!.entities.keys());
    project = addRelationship(project, languageId, parkId, guestId, [0, 1000]);
    const relationshipId = project.languages.get(languageId)!.entities.get(parkId)!.relationships[0].id;

    project = removeRelationship(project, languageId, parkId, relationshipId);

    expect(project.languages.get(languageId)!.entities.get(parkId)!.relationships).toHaveLength(0);
  });

  it("removeAction removes only the matching action", () => {
    const domain = createDomain("Tycoon Domain");
    let project: Project = { ...emptyProject(), domains: [domain] };
    project = addLanguage(project, domain.id, "Tycoon");
    const languageId = Array.from(project.languages.keys())[0];
    project = addEntity(project, languageId, "Park");
    const parkId = Array.from(project.languages.get(languageId)!.entities.keys())[0];
    project = addAction(project, languageId, parkId, "Admit", [], parkId);
    const actionId = project.languages.get(languageId)!.entities.get(parkId)!.actions[0].id;

    project = removeAction(project, languageId, parkId, actionId);

    expect(project.languages.get(languageId)!.entities.get(parkId)!.actions).toHaveLength(0);
  });

  it("removeInteraction cascades to transformation interaction mappings", () => {
    const domain = createDomain("Tycoon Domain");
    let project: Project = { ...emptyProject(), domains: [domain] };
    project = addLanguage(project, domain.id, "Tycoon");
    const languageId = Array.from(project.languages.keys())[0];
    project = addInteraction(project, "Bill", languageId, languageId, [], "");
    const interactionId = Array.from(project.languages.get(languageId)!.interactions.keys())[0];
    project = addTransformation(project, domain.id, languageId, languageId, [], [
      { sourceId: interactionId, targetSubgraph: { entityIds: [], interactionIds: [] } },
    ]);

    project = removeInteraction(project, languageId, interactionId);

    expect(project.languages.get(languageId)!.interactions.has(interactionId)).toBe(false);
    const transformation = Array.from(project.domains[0].transformations.values())[0];
    expect(transformation.interactionMappings).toHaveLength(0);
  });

  it("removeTransformation removes only the matching transformation", () => {
    const domain = createDomain("Tycoon Domain");
    let project: Project = { ...emptyProject(), domains: [domain] };
    project = addLanguage(project, domain.id, "Tycoon");
    const languageId = Array.from(project.languages.keys())[0];
    project = addTransformation(project, domain.id, languageId, languageId);
    const transformationId = Array.from(project.domains[0].transformations.keys())[0];

    project = removeTransformation(project, domain.id, transformationId);

    expect(project.domains[0].transformations.size).toBe(0);
  });

  it("removeDomain drops mediations that named it in any role", () => {
    const domainA = createDomain("A");
    const domainB = createDomain("B");
    let project: Project = { ...emptyProject(), domains: [domainA, domainB] };
    project = { ...project, mediations: addMediation(project.mediations, domainA.id, domainB.id, domainA.id) };

    project = removeDomain(project, domainA.id);

    expect(project.domains).toHaveLength(1);
    expect(project.mediations).toHaveLength(0);
  });

  it("removeLanguage cascades through its entities and clears domain references/transformations", () => {
    const domainA = createDomain("A");
    const domainB = createDomain("B");
    let project: Project = { ...emptyProject(), domains: [domainA, domainB] };
    project = addLanguage(project, domainA.id, "Shared");
    const languageId = Array.from(project.languages.keys())[0];
    project = referenceLanguage(project, domainB.id, languageId);
    project = addEntity(project, languageId, "Park");
    project = addTransformation(project, domainA.id, languageId, languageId);

    project = removeLanguage(project, languageId);

    expect(project.languages.has(languageId)).toBe(false);
    expect(project.domains[0].languageIds.has(languageId)).toBe(false);
    expect(project.domains[1].languageIds.has(languageId)).toBe(false);
    expect(project.domains[0].transformations.size).toBe(0);
  });
});
