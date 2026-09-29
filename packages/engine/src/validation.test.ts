import { describe, expect, it } from "vitest";
import {
  addAction,
  addEntity,
  addInteraction,
  addLanguage,
  addRelationship,
  addTransformation,
  createLayer,
} from "./builders.js";
import {
  checkActionPurity,
  checkInteractionAlignment,
  checkRelationshipCardinality,
  checkRelationshipConstraints,
  checkTauCompleteness,
} from "./validation.js";

function twoLanguageLayer() {
  let layers = [createLayer("Tycoon Domain")];
  const layerId = layers[0].id;
  layers = addLanguage(layers, layerId, "Tycoon");
  layers = addLanguage(layers, layerId, "HTTP");
  const [tycoonId, httpId] = Array.from(layers[0].languages.keys());
  return { layers, layerId, tycoonId, httpId };
}

describe("checkActionPurity", () => {
  it("passes when an action's types stay within its own language", () => {
    const { layers, layerId, tycoonId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addEntity(l, layerId, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(l[0].languages.get(tycoonId)!.entities.keys());
    l = addAction(l, layerId, tycoonId, parkId, "Admit", [guestId], guestId);

    expect(checkActionPurity(l)).toHaveLength(0);
  });

  it("flags an action whose input type leaks from another language", () => {
    const { layers, layerId, tycoonId, httpId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addEntity(l, layerId, httpId, "Request");
    const parkId = Array.from(l[0].languages.get(tycoonId)!.entities.keys())[0];
    const requestId = Array.from(l[0].languages.get(httpId)!.entities.keys())[0];
    l = addAction(l, layerId, tycoonId, parkId, "Bill", [requestId], parkId);

    const findings = checkActionPurity(l);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe("Action 'Bill' on Entity 'Park' leaks type from external language.");
  });
});

describe("checkInteractionAlignment", () => {
  it("passes when both languages belong to the layer", () => {
    const { layers, layerId, tycoonId, httpId } = twoLanguageLayer();
    const l = addInteraction(layers, layerId, "Bill", tycoonId, httpId, [], "");

    expect(checkInteractionAlignment(l)).toHaveLength(0);
  });

  it("flags an interaction referencing a language outside the layer", () => {
    const { layers, layerId, tycoonId } = twoLanguageLayer();
    const l = addInteraction(layers, layerId, "Bill", tycoonId, "not-a-real-language", [], "");

    const findings = checkInteractionAlignment(l);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe(
      "Interaction 'Bill' references language outside containing layer."
    );
  });
});

describe("checkTauCompleteness", () => {
  it("passes when every source entity has a mapping", () => {
    const { layers, layerId, tycoonId, httpId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    const parkId = Array.from(l[0].languages.get(tycoonId)!.entities.keys())[0];
    l = addTransformation(l, layerId, tycoonId, httpId, [
      { sourceId: parkId, targetSubgraph: { entityIds: [], interactionIds: [] } },
    ]);

    expect(checkTauCompleteness(l)).toHaveLength(0);
  });

  it("warns about an unmapped source entity", () => {
    const { layers, layerId, tycoonId, httpId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addTransformation(l, layerId, tycoonId, httpId);

    const findings = checkTauCompleteness(l);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].message).toBe("Unmapped intent entity 'Park' in translation layer.");
  });
});

describe("checkRelationshipCardinality", () => {
  it("passes for a well-formed bound", () => {
    const { layers, layerId, tycoonId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addEntity(l, layerId, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(l[0].languages.get(tycoonId)!.entities.keys());
    l = addRelationship(l, layerId, tycoonId, parkId, guestId, [0, 1000]);

    expect(checkRelationshipCardinality(l)).toHaveLength(0);
  });

  it("flags a bound where min exceeds max", () => {
    const { layers, layerId, tycoonId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addEntity(l, layerId, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(l[0].languages.get(tycoonId)!.entities.keys());
    l = addRelationship(l, layerId, tycoonId, parkId, guestId, [5, 1]);

    const findings = checkRelationshipCardinality(l);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe(
      "Relationship on Entity 'Park' has an invalid cardinality bound [5, 1]."
    );
  });
});

describe("checkRelationshipConstraints", () => {
  it("passes when the predicate holds", () => {
    const { layers, layerId, tycoonId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addEntity(l, layerId, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(l[0].languages.get(tycoonId)!.entities.keys());
    l = addRelationship(l, layerId, tycoonId, parkId, guestId, [0, 1000], [
      { id: "c1", expression: "self.languageId == child.languageId" },
    ]);

    expect(checkRelationshipConstraints(l)).toHaveLength(0);
  });

  it("flags a violated predicate", () => {
    const { layers, layerId, tycoonId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addEntity(l, layerId, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(l[0].languages.get(tycoonId)!.entities.keys());
    l = addRelationship(l, layerId, tycoonId, parkId, guestId, [0, 1000], [
      { id: "c1", expression: "self.name == child.name" },
    ]);

    const findings = checkRelationshipConstraints(l);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toBe(
      "Relationship constraint on Entity 'Park' violated: self.name == child.name"
    );
  });

  it("flags a malformed predicate as a failed evaluation", () => {
    const { layers, layerId, tycoonId } = twoLanguageLayer();
    let l = addEntity(layers, layerId, tycoonId, "Park");
    l = addEntity(l, layerId, tycoonId, "Guest");
    const [parkId, guestId] = Array.from(l[0].languages.get(tycoonId)!.entities.keys());
    l = addRelationship(l, layerId, tycoonId, parkId, guestId, [0, 1000], [
      { id: "c1", expression: "self.bogus == 1" },
    ]);

    const findings = checkRelationshipConstraints(l);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("failed to evaluate");
  });
});
