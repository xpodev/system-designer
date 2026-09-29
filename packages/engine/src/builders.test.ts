import { describe, expect, it } from "vitest";
import { addEntity, addLanguage, addRelationship, createLayer, removeEntity } from "./builders.js";

describe("builders", () => {
  it("createLayer starts empty and impure (no languages yet)", () => {
    const layer = createLayer("Tycoon Domain");
    expect(layer.languages.size).toBe(0);
    expect(layer.isPure).toBe(false);
  });

  it("addLanguage does not mutate the input layers array", () => {
    const before = [createLayer("Tycoon Domain")];
    const snapshotSize = before[0].languages.size;

    const after = addLanguage(before, before[0].id, "Tycoon");

    expect(before[0].languages.size).toBe(snapshotSize);
    expect(after[0].languages.size).toBe(1);
    expect(after[0].isPure).toBe(true);
  });

  it("addLanguage flips isPure to false once a second language is added", () => {
    let layers = [createLayer("Tycoon Domain")];
    const layerId = layers[0].id;
    layers = addLanguage(layers, layerId, "Tycoon");
    layers = addLanguage(layers, layerId, "HTTP");

    expect(layers[0].isPure).toBe(false);
    expect(layers[0].languages.size).toBe(2);
  });

  it("addEntity does not mutate the input layers array", () => {
    let layers = [createLayer("Tycoon Domain")];
    const layerId = layers[0].id;
    layers = addLanguage(layers, layerId, "Tycoon");
    const languageId = Array.from(layers[0].languages.keys())[0];
    const before = layers;

    const after = addEntity(before, layerId, languageId, "Park");

    expect(before[0].languages.get(languageId)!.entities.size).toBe(0);
    expect(after[0].languages.get(languageId)!.entities.size).toBe(1);
  });

  it("removeEntity cascades to relationships that target it", () => {
    let layers = [createLayer("Tycoon Domain")];
    const layerId = layers[0].id;
    layers = addLanguage(layers, layerId, "Tycoon");
    const languageId = Array.from(layers[0].languages.keys())[0];
    layers = addEntity(layers, layerId, languageId, "Park");
    layers = addEntity(layers, layerId, languageId, "Guest");
    const [parkId, guestId] = Array.from(layers[0].languages.get(languageId)!.entities.keys());
    layers = addRelationship(layers, layerId, languageId, parkId, guestId, [0, 1000]);

    layers = removeEntity(layers, layerId, languageId, guestId);

    const language = layers[0].languages.get(languageId)!;
    expect(language.entities.has(guestId)).toBe(false);
    expect(language.entities.get(parkId)!.relationships).toHaveLength(0);
  });
});
