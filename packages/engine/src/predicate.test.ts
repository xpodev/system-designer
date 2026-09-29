import { describe, expect, it } from "vitest";
import { PredicateError, evaluatePredicate } from "./predicate.js";

describe("evaluatePredicate", () => {
  it("evaluates a simple equality", () => {
    expect(evaluatePredicate("self.languageId == child.languageId", { self: { languageId: "a" }, child: { languageId: "a" } })).toBe(true);
    expect(evaluatePredicate("self.languageId == child.languageId", { self: { languageId: "a" }, child: { languageId: "b" } })).toBe(false);
  });

  it("evaluates inequality, and, or, parens", () => {
    const ctx = { self: { name: "Park" }, child: { name: "Guest" } };
    expect(evaluatePredicate("self.name != child.name", ctx)).toBe(true);
    expect(evaluatePredicate("(self.name == 'Park') && (child.name == 'Guest')", ctx)).toBe(true);
    expect(evaluatePredicate("(self.name == 'nope') || (child.name == 'Guest')", ctx)).toBe(true);
    expect(evaluatePredicate("(self.name == 'nope') || (child.name == 'nope')", ctx)).toBe(false);
  });

  it("throws PredicateError for an unresolvable property path", () => {
    expect(() => evaluatePredicate("self.nope == 1", { self: {} })).toThrow(PredicateError);
  });

  it("throws PredicateError for malformed syntax", () => {
    expect(() => evaluatePredicate("self.name ==", { self: {} })).toThrow(PredicateError);
    expect(() => evaluatePredicate("(self.name == 'x'", { self: { name: "x" } })).toThrow(PredicateError);
  });
});
