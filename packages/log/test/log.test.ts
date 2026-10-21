import { Target, undo } from "@systemathic/editing";
import { ComponentEditor } from "@systemathic/editors";
import { newSystem, open, save } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import { entries, keep, keeping, log } from "../src/index.js";

describe("the Log", () => {
  it("is kept only when a System is told to keep one", () => {
    const target = new Target(newSystem("Shop"));
    log(target);
    ComponentEditor.addLanguage(target.startSession("ui"), "system.root", "Catalog");
    expect(keeping(target.context)).toBe(false);
    expect(target.context.attachments).toEqual([]);
  });

  it("records who did what, and when, with the System, across reopening", () => {
    const target = new Target(newSystem("Shop"));
    const ui = target.startSession("ui");
    const stop = log(target, () => new Date("2026-10-21T10:00:00Z"));
    keep(target.context, true);
    ComponentEditor.addLanguage(ui, "system.root", "Catalog");
    undo(ui);
    expect(entries(target.context)).toEqual([
      { at: "2026-10-21T10:00:00.000Z", client: "ui", role: "do", kind: "addition", summary: "addLanguage Catalog", elements: expect.any(Array) },
      { at: "2026-10-21T10:00:00.000Z", client: "ui", role: "undo", kind: "removal", summary: "undo addLanguage Catalog", elements: expect.any(Array) },
    ]);
    stop();

    const reopened = new Target(open(save(target.context)));
    log(reopened);
    ComponentEditor.addLanguage(reopened.startSession("mcp"), "system.root", "Orders");
    expect(entries(reopened.context).map((entry) => [entry.client, entry.summary])).toEqual([
      ["ui", "addLanguage Catalog"],
      ["ui", "undo addLanguage Catalog"],
      ["mcp", "addLanguage Orders"],
    ]);
    expect(reopened.history.edits).toHaveLength(1);
  });

  it("forgets what it held when the System stops keeping it", () => {
    const target = new Target(newSystem("Shop"));
    log(target);
    keep(target.context, true);
    ComponentEditor.addLanguage(target.startSession("ui"), "system.root", "Catalog");
    keep(target.context, false);
    expect(keeping(target.context)).toBe(false);
    expect(entries(target.context)).toEqual([]);
    expect(target.context.attachments).toEqual([]);
  });
});
