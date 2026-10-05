import { nameOf, remove, setName } from "@systemathic/core";
import { newSystem } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import { redo, Target, undo, type Effect, type Edit } from "../src/index.js";

function setup() {
  const target = new Target(newSystem("Game"));
  const ui = target.startSession("ui");
  const llm = target.startSession("mcp");
  const addLanguage = (session = ui, id = "core", name = "Core") =>
    session.edit("addition", `addLanguage ${name}`, [id], (graph) => {
      graph.add("Language", id);
      setName(graph, id, name);
      graph.connect("system", "languages", id);
    });
  return { target, ui, llm, addLanguage };
}

describe("editing", () => {
  it("keeps one History, in application order, with every Edit's author", () => {
    const { target, ui, llm, addLanguage } = setup();
    addLanguage(ui, "core", "Core");
    addLanguage(llm, "combat", "Combat");
    expect(target.history.edits.map((edit) => [edit.id, edit.author, edit.summary])).toEqual([
      [1, ui.id, "addLanguage Core"],
      [2, llm.id, "addLanguage Combat"],
    ]);
  });

  it("tells every session of every Edit", () => {
    const { ui, llm, addLanguage } = setup();
    const seen: Record<string, number[]> = { ui: [], llm: [] };
    ui.onEdit((edit) => seen.ui!.push(edit.id));
    llm.onEdit((edit) => seen.llm!.push(edit.id));
    addLanguage(ui);
    addLanguage(llm, "combat", "Combat");
    expect(seen).toEqual({ ui: [1, 2], llm: [1, 2] });
  });

  it("records the Elements an Edit touched, without names", () => {
    const { addLanguage } = setup();
    expect(addLanguage().elements).toEqual(["core", "system"]);
  });

  it("undoes a session's own Edits only, newest first, and never shrinks the History", () => {
    const { target, ui, llm, addLanguage } = setup();
    addLanguage(ui, "core", "Core");
    addLanguage(llm, "combat", "Combat");
    addLanguage(ui, "net", "Network");

    const first = undo(ui)!;
    expect(first).toMatchObject({ kind: "removal", reverts: 3, author: ui.id, summary: "undo addLanguage Network" });
    expect(target.graph.has("net")).toBe(false);
    expect(undo(ui)).toMatchObject({ reverts: 1 });
    expect(target.graph.has("core")).toBe(false);
    expect(target.graph.has("combat")).toBe(true);
    expect(undo(ui)).toBeUndefined();
    expect(target.history.edits).toHaveLength(5);
  });

  it("redoes what was undone, newest first, until the session makes a new Edit", () => {
    const { target, ui, addLanguage } = setup();
    addLanguage(ui, "core", "Core");
    addLanguage(ui, "net", "Network");
    undo(ui);
    undo(ui);
    expect(redo(ui)).toMatchObject({ kind: "addition", summary: "redo addLanguage Core" });
    expect(target.graph.has("core")).toBe(true);
    expect(target.graph.has("net")).toBe(false);
    expect(undo(ui)).toMatchObject({ summary: "undo addLanguage Core" });
    expect(redo(ui)).toMatchObject({ summary: "redo addLanguage Core" });
    expect(redo(ui)).toMatchObject({ summary: "redo addLanguage Network" });
    expect(redo(ui)).toBeUndefined();
    undo(ui);
    addLanguage(ui, "ops", "Operations");
    expect(redo(ui)).toBeUndefined();
    expect(target.history.edits.map((edit) => target.role(edit))).toEqual(["do", "do", "undo", "undo", "redo", "undo", "redo", "redo", "undo", "do"]);
  });

  it("undoes as far as still applies after another session's Edits", () => {
    const { target, ui, llm, addLanguage } = setup();
    addLanguage(ui);
    llm.edit("change", "rename Core", ["core"], (graph) => setName(graph, "core", "Kernel"));
    undo(ui);
    expect(target.graph.has("core")).toBe(false);
    undo(llm);
    expect(target.graph.has("core")).toBe(false);
  });

  it("never refuses an ill-formed result", () => {
    const { target, ui, addLanguage } = setup();
    addLanguage();
    const edit: Edit = ui.edit("removal", "remove System", ["system"], (graph) => void remove(graph, "system"));
    expect(edit.kind).toBe("removal");
    expect(target.graph.has("core")).toBe(false);
    undo(ui);
    expect(nameOf(target.graph, "core")).toBe("Core");
  });

  it("keeps each session's own Selection, and drops removed Elements from it", () => {
    const { ui, llm, addLanguage } = setup();
    addLanguage();
    ui.select(["core", "nothing"]);
    llm.select(["system"]);
    expect(ui.selection).toEqual(["core"]);
    undo(ui);
    expect(ui.selection).toEqual([]);
    expect(llm.selection).toEqual(["system"]);
  });

  it("refuses a session of another Target", () => {
    const { ui } = setup();
    const other = new Target(newSystem());
    expect(() => other.apply(ui, "change", "x", [], () => {})).toThrow("does not edit this Target");
  });

  it("undoes and redoes any Effect that can revert itself, not only the graph's, on the one History", () => {
    const { target, ui, addLanguage } = setup();
    // A setting kept beside the design: its Effect is a value, and the value it replaced.
    let note = "";
    const set = (value: string): Effect => {
      const before = note;
      note = value;
      return { touched: ["system"], revert: () => set(before) };
    };
    addLanguage();
    ui.record("change", "note", [], () => set("first"));
    ui.record("change", "note", [], () => set("second"));
    expect(target.history.edits.at(-1)!.elements).toEqual(["system"]);
    undo(ui);
    expect(note).toBe("first");
    undo(ui);
    expect(note).toBe("");
    undo(ui);
    expect(target.graph.has("core")).toBe(false);
    redo(ui);
    redo(ui);
    expect([target.graph.has("core"), note]).toEqual([true, "first"]);
    expect(target.history.edits.map((edit) => target.role(edit))).toEqual(["do", "do", "do", "undo", "undo", "undo", "redo", "redo"]);
  });
});
