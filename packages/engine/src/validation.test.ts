import { describe, expect, it } from "vitest";
import {
  addAction,
  addEntity,
  addInteraction,
  addLanguage,
  addRelationship,
  addTransformation,
  createDomain,
  unreferenceLanguage,
} from "./builders.js";
import type { Project } from "./types.js";
import {
  checkActionPurity,
  checkInteractionAlignment,
  checkRelationshipCardinality,
  checkRelationshipConstraints,
  checkTauCompleteness,
} from "./validation.js";

function emptyProject(): Project {
  return { languages: new Map(), domains: [], mediations: [] };
}

/** One domain referencing two languages — the common case where an
 *  interaction between them is expected to validate cleanly. */
function twoLanguageDomain() {
  const domain = createDomain("Tycoon Domain");
  let project: Project = { ...emptyProject(), domains: [domain] };
  project = addLanguage(project, domain.id, "Tycoon");
  project = addLanguage(project, domain.id, "HTTP");
  const [tycoonId, httpId] = Array.from(project.languages.keys());
  return { project, domainId: domain.id, tycoonId, httpId };
}

describe("checkActionPurity", () => {
  it("passes when an action's types stay within its own language", () => {
    const { project, tycoonId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addEntity(p, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(p.languages.get(tycoonId)!.entities.keys());
    p = addAction(p, tycoonId, parkId, "Admit", [guestId], guestId);

    expect(checkActionPurity(p)).toHaveLength(0);
  });

  it("flags an action whose input type leaks from another language", () => {
    const { project, tycoonId, httpId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addEntity(p, httpId, "Request");
    const parkId = Array.from(p.languages.get(tycoonId)!.entities.keys())[0];
    const requestId = Array.from(p.languages.get(httpId)!.entities.keys())[0];
    p = addAction(p, tycoonId, parkId, "Bill", [requestId], parkId);

    const findings = checkActionPurity(p);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe("Action 'Bill' on Entity 'Park' leaks type from external language.");
  });
});

describe("checkInteractionAlignment", () => {
  it("passes when a domain references both languages", () => {
    const { project, tycoonId, httpId } = twoLanguageDomain();
    const p = addInteraction(project, "Bill", tycoonId, httpId, [], "");

    expect(checkInteractionAlignment(p)).toHaveLength(0);
  });

  it("flags an interaction whose languages share no common domain", () => {
    const { project, domainId, tycoonId, httpId } = twoLanguageDomain();
    let p = unreferenceLanguage(project, domainId, httpId);
    p = addInteraction(p, "Bill", tycoonId, httpId, [], "");

    const findings = checkInteractionAlignment(p);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe(
      "Interaction 'Bill' references languages with no common domain."
    );
  });
});

describe("checkTauCompleteness", () => {
  it("passes when every source entity has a mapping", () => {
    const { project, domainId, tycoonId, httpId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    const parkId = Array.from(p.languages.get(tycoonId)!.entities.keys())[0];
    p = addTransformation(p, domainId, tycoonId, httpId, [
      { sourceId: parkId, targetSubgraph: { entityIds: [], interactionIds: [] } },
    ]);

    expect(checkTauCompleteness(p)).toHaveLength(0);
  });

  it("warns about an unmapped source entity", () => {
    const { project, domainId, tycoonId, httpId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addTransformation(p, domainId, tycoonId, httpId);

    const findings = checkTauCompleteness(p);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].message).toBe("Unmapped intent entity 'Park' in translation domain.");
  });
});

describe("checkRelationshipCardinality", () => {
  it("passes for a well-formed bound", () => {
    const { project, tycoonId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addEntity(p, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(p.languages.get(tycoonId)!.entities.keys());
    p = addRelationship(p, tycoonId, parkId, guestId, [0, 1000]);

    expect(checkRelationshipCardinality(p)).toHaveLength(0);
  });

  it("flags a bound where min exceeds max", () => {
    const { project, tycoonId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addEntity(p, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(p.languages.get(tycoonId)!.entities.keys());
    p = addRelationship(p, tycoonId, parkId, guestId, [5, 1]);

    const findings = checkRelationshipCardinality(p);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe(
      "Relationship on Entity 'Park' has an invalid cardinality bound [5, 1]."
    );
  });
});

describe("checkRelationshipConstraints", () => {
  it("passes when the predicate holds", () => {
    const { project, tycoonId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addEntity(p, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(p.languages.get(tycoonId)!.entities.keys());
    p = addRelationship(p, tycoonId, parkId, guestId, [0, 1000], [
      { id: "c1", expression: "self.languageId == child.languageId" },
    ]);

    expect(checkRelationshipConstraints(p)).toHaveLength(0);
  });

  it("flags a violated predicate", () => {
    const { project, tycoonId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addEntity(p, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(p.languages.get(tycoonId)!.entities.keys());
    p = addRelationship(p, tycoonId, parkId, guestId, [0, 1000], [
      { id: "c1", expression: "self.name == child.name" },
    ]);

    const findings = checkRelationshipConstraints(p);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe(
      "Relationship constraint on Entity 'Park' violated: self.name == child.name"
    );
  });

  it("flags a malformed predicate as a failed evaluation", () => {
    const { project, tycoonId } = twoLanguageDomain();
    let p = addEntity(project, tycoonId, "Park");
    p = addEntity(p, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(p.languages.get(tycoonId)!.entities.keys());
    p = addRelationship(p, tycoonId, parkId, guestId, [0, 1000], [
      { id: "c1", expression: "self.bogus == 1" },
    ]);

    const findings = checkRelationshipConstraints(p);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("failed to evaluate");
  });
});
