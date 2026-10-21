import { Target, redo, undo } from "@systemathic/editing";
import { ArgumentError, ComponentEditor, LanguageEditor } from "@systemathic/editors";
import { newSystem, open, save } from "@systemathic/tool";
import { readSystem, writeSystem } from "@systemathic/tool-json";
import { describe as group, expect, it } from "vitest";
import { describe, descriptionOf, descriptions, documentationEditor, documentationProvider } from "../src/index.js";
import type { SystemContext } from "@systemathic/tool";

/** The System as it is stored, once Documentation has saved into a copy of it. */
async function saved(context: SystemContext) {
  const copy = open(save(context));
  await documentationProvider.save(copy, undefined);
  return save(copy);
}

function game() {
  const target = new Target(newSystem("Game"));
  const s = target.startSession("test");
  const core = ComponentEditor.addLanguage(s, "system.root", "Core").elements[0]!;
  const monster = LanguageEditor.addEntity(s, core, "Monster").elements[0]!;
  return { target, s, core, monster };
}

group("documentation", () => {
  it("describes things of the System, beside the design, which it leaves untouched", () => {
    const { target, s, core, monster } = game();
    const before = writeSystem(save(target.context)).design;
    describe(s, "system", "A small game.");
    describe(s, monster, "Something to fight.\n\nIt has *hit points*.");
    expect(descriptionOf(target.context, monster)).toBe("Something to fight.\n\nIt has *hit points*.");
    expect([...descriptions(target.context).keys()]).toEqual(["system", monster]);
    expect(descriptionOf(target.context, core)).toBeUndefined();
    expect(writeSystem(save(target.context)).design).toEqual(before);
    expect(target.history.edits.at(-1)).toMatchObject({ kind: "change", summary: "describe Entity", elements: [monster] });
  });

  it("is undone and redone on the one History, with the design's Edits", () => {
    const { target, s, monster } = game();
    describe(s, monster, "Something to fight.");
    describe(s, monster, "A monster.");
    describe(s, monster, "   ");
    expect(descriptionOf(target.context, monster)).toBeUndefined();
    expect(target.history.edits.at(-1)!.summary).toBe("undescribe Entity");
    undo(s);
    expect(descriptionOf(target.context, monster)).toBe("A monster.");
    undo(s);
    expect(descriptionOf(target.context, monster)).toBe("Something to fight.");
    redo(s);
    expect(descriptionOf(target.context, monster)).toBe("A monster.");
  });

  it("forgets what is removed, and remembers it when the removal is undone", () => {
    const { target, s, monster } = game();
    describe(s, monster, "Something to fight.");
    LanguageEditor.remove(s, target.graph.navigate(monster, "language")[0]!);
    expect(descriptions(target.context).size).toBe(0);
    undo(s);
    expect(descriptionOf(target.context, monster)).toBe("Something to fight.");
  });

  it("is kept with the System when it is saved and opened again", () => {
    const { target, s, monster } = game();
    describe(s, monster, "Something to fight.");
    const reopened = open(readSystem(JSON.parse(JSON.stringify(writeSystem(save(target.context))))).system);
    expect(descriptionOf(reopened, monster)).toBe("Something to fight.");
  });

  it("leaves the Descriptions of what was removed behind when it is saved", async () => {
    const { target, s, monster } = game();
    describe(s, "system", "A small game.");
    describe(s, monster, "Something to fight.");
    LanguageEditor.remove(s, target.graph.navigate(monster, "language")[0]!);
    const file = writeSystem(await saved(target.context));
    expect(file.attachments).toEqual([{ owner: "documentation", data: { descriptions: { system: "A small game." } } }]);
    describe(s, "system", "");
    expect(writeSystem(await saved(target.context)).attachments).toEqual([]);
    undo(s);
    undo(s);
    expect(descriptionOf(target.context, monster)).toBe("Something to fight.");
  });

  it("is an operation clients are built from, which refuses what cannot be described", () => {
    const { target, s, monster } = game();
    const [operation] = documentationEditor;
    expect(operation!.parameters.map((p) => p.name)).toEqual(["subject", "text"]);
    operation!.run(s, { subject: monster, text: "Something to fight." });
    expect(descriptionOf(target.context, monster)).toBe("Something to fight.");
    const [end] = target.graph.ofEntity("Bound");
    expect(() => operation!.run(s, { subject: end, text: "x" })).toThrow(ArgumentError);
    expect(() => operation!.run(s, { subject: monster })).toThrow("text: expected text");
  });
});
