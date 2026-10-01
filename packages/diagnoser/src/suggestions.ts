/**
 * Ways to fix a structural error, by the axiom it violates. A Suggestion says what to do and
 * names the Subjects it would change, taken from the assignment that falsified the axiom
 * (its variables, as the schema names them). Axioms without an entry here get none.
 */
import type { Environment } from "@systemathic/core";

export interface Suggestion {
  readonly message: string;
  /** Ids of what the fix would change. */
  readonly subjects: readonly string[];
}

type Suggest = (env: Environment) => Suggestion;

const at = (env: Environment, ...names: string[]) => names.map((name) => env.get(name)).filter((id): id is string => id !== undefined);
const fix = (message: string, ...names: string[]): Suggest => (env) => ({ message, subjects: at(env, ...names) });

/** By the axiom's `about`, which is unique among the core's and Std's axioms. */
const byAxiom: Readonly<Record<string, Suggest>> = {
  "Relationship ends are in the Relationship's Language": fix("Put an Entity of the Relationship's own Language at this end", "e"),
  "A formula mentions only its own Language's Entities": fix("Rewrite the formula over its own Language's Entities", "f"),
  "A formula mentions only its own Language's ends": fix("Rewrite the formula over its own Language's ends", "f"),
  "A constraint is in its Relationship's Language": fix("Constrain a Relationship of the formula's own Language, or none", "f"),
  "min <= max, where max is present": fix("Make the end's min at most its max", "e"),
  "From any Entity, the ends reachable across its Relationships have distinct names": fix("Rename one of the two ends", "a", "b"),
  "A Transformation's source is in scope of its holder": fix("Make the holding Domain reference the source Language, or a Domain that does", "t"),
  "A Transformation's target is in scope of its holder": fix("Make the holding Domain reference the target Language, or a Domain that does", "t"),
  "A Relationship mapping requires both end Entities mapped": fix("Map the Entities at both ends of the Relationship first", "m"),
  "Every Mediation is witnessed by a reversible Transformation of its mediator": fix(
    "Give the mediator a Transformation with a reverse, from a Language of the what to a Language of the how",
    "m",
  ),
  "Entity mapping sources are in the source Language": fix("Map an Entity of the Transformation's source Language", "m"),
  "Entity mapping targets are in the target Language": fix("Map to Entities of the Transformation's target Language only", "m"),
  "Relationship mapping sources are in the source Language": fix("Map a Relationship of the Transformation's source Language", "m"),
  "Relationship mapping targets are in the target Language": fix("Map to Relationships of the Transformation's target Language only", "m"),
  "Target Relationships join images of the source Relationship's ends": fix(
    "Map to Relationships joining the Entities the source Relationship's ends are mapped to",
    "m",
  ),
  "A reverse's context is drawn from its Transformation's Languages": fix("Keep only Entities of the Transformation's Languages as context", "v"),
  "A Domain references only Languages of its own System": fix("Reference a Language of the Domain's own System", "d"),
  "A Domain references only Domains of its own System": fix("Reference a Domain of its own System", "d"),
  "Parameter types are in the Interaction's Language": fix("Type the Parameter with an Entity of the Interaction's own Language", "p"),
  "The output is in the Interaction's Language": fix("Make the output an Entity of the Interaction's own Language", "i"),
  "An Interaction mapping requires its Parameter types mapped": fix("Map the Parameter's Entity first", "m"),
  "An Interaction mapping requires its output mapped": fix("Map the output Entity first", "m"),
  "Interaction mapping sources are in the source Language": fix("Map an Interaction of the Transformation's source Language", "m"),
  "Interaction mapping targets are in the target Language": fix("Map to Interactions of the Transformation's target Language only", "m"),
  "An Action's primary Parameter is one of its own": fix("Choose one of the Interaction's own Parameters as primary, or none", "i"),
  "A comparison is an Interaction of its Entity's Language": fix("Choose an Interaction of the Entity's own Language as its comparison", "e"),
  "A deferral names exactly one item": fix("Defer exactly one Entity, Relationship or Interaction", "d"),
  "A deferred Entity is in the source Language": fix("Defer only items of the Transformation's source Language", "d"),
  "A deferred Relationship is in the source Language": fix("Defer only items of the Transformation's source Language", "d"),
  "A deferred Interaction is in the source Language": fix("Defer only items of the Transformation's source Language", "d"),
};

/** The axioms there are suggestions for. */
export const suggestedAxioms: readonly string[] = Object.keys(byAxiom);

export function axiomSuggestions(about: string, env: Environment): Suggestion[] {
  const suggest = byAxiom[about];
  return suggest ? [suggest(env)] : [];
}

/** For a range error: add or remove links through the end. */
export function rangeSuggestions(id: string, end: string, count: number, min: number, max: number | null): Suggestion[] {
  if (count < min) return [{ message: `Link ${min - count} more through '${end}'`, subjects: [id] }];
  if (max !== null && count > max) return [{ message: `Unlink ${count - max} through '${end}'`, subjects: [id] }];
  return [];
}
