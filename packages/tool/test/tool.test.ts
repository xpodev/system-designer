import { nameOf } from "@systemathic/core";
import { describe, expect, it } from "vitest";
import { newSystem, open, save } from "../src/index.js";

describe("Tool", () => {
  it("creates a named System", () => {
    const context = newSystem("Game");
    expect(nameOf(context.design, context.system!)).toBe("Game");
  });

  it("opens and saves independent copies", () => {
    const context = newSystem("Game");
    const stored = save(context.attach({ owner: "ui", data: { zoom: 2 } }));
    context.design.add("Language", "combat");
    const reopened = open(stored);
    expect(reopened.design.has("combat")).toBe(false);
    expect(reopened.attachments).toEqual([{ owner: "ui", data: { zoom: 2 } }]);
  });

  it("detaches only the given attachment", () => {
    const context = newSystem();
    const keep = { owner: "ui", data: 1 };
    const drop = { owner: "ui", data: 2 };
    context.attach(keep).attach(drop).detach(drop);
    expect(context.attachments).toEqual([keep]);
  });
});
