import { describe, expect, it } from "vitest";
import { addMediation, removeMediation } from "./mediation.js";

describe("mediation", () => {
  it("addMediation does not mutate the input array", () => {
    const before: ReturnType<typeof addMediation> = [];
    const after = addMediation(before, "intent-layer", "mediator-layer", "impl-layer");

    expect(before).toHaveLength(0);
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      intentLayerId: "intent-layer",
      mediatorLayerId: "mediator-layer",
      implementationLayerId: "impl-layer",
    });
  });

  it("removeMediation removes only the matching id", () => {
    let mediations = addMediation([], "a", "b", "c");
    mediations = addMediation(mediations, "x", "y", "z");
    const target = mediations[0].id;

    const after = removeMediation(mediations, target);

    expect(after).toHaveLength(1);
    expect(after.find((m) => m.id === target)).toBeUndefined();
  });
});
