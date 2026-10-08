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

const REALIZE = "Realize the Mediation between its What's Language and its Medium's";
const REALIZATION_ACCESS = "Import the realization into the Component at this end of the Connection";

/** By the axiom's `about`, which is unique among the core's and Std's axioms. */
const byAxiom: Readonly<Record<string, Suggest>> = {
  // Kernel
  "Relationship ends are in the vocabulary of the Relationship's Language": fix(
    "Put an Entity of the Language's vocabulary at this end, or make the Language extend the one this Entity is in",
    "e",
  ),
  "An Entity extends only Entities of the Languages its Language extends": fix("Make the Entity's Language extend the Language of what it extends, or extend another Entity", "e"),
  "A formula mentions only Entities of its Language's vocabulary": fix("Rewrite the formula over its Language's vocabulary", "f"),
  "A formula mentions only ends of its Language's vocabulary": fix("Rewrite the formula over its Language's vocabulary", "f"),
  "A constraint is on a Relationship of its Language's vocabulary": fix("Constrain a Relationship of the formula's Language's vocabulary, or none", "f"),
  "min <= max, where max is present": fix("Make the end's min at most its max", "e"),
  "In every Language, from any Entity, the named ends reachable across its vocabulary, its own and those of what it extends, have distinct names": fix(
    "Rename one of the two ends",
    "a",
    "b",
  ),
  "No Language extends itself, eventually": fix("Stop one of the Languages in the cycle extending the next", "l"),
  "No Entity extends itself, eventually": fix("Stop one of the Entities in the cycle extending the next", "e"),
  // Contexts
  "Every Component is either nested in another or beside the root of a System": fix("Nest the Component in another, or put it beside the root", "c"),
  "A System's root is one of its top-level Components": fix("Make one of the System's top-level Components its root", "s"),
  "No Component is nested in itself, eventually": fix("Move the Component out of its own nesting", "c"),
  "A Component uses only Languages in its scope: its own and its parents', and those of the Components it imports": fix(
    "Import the Component that defines the Language, or stop using it",
    "c",
    "l",
  ),
  "A Language extends only Languages in the scope of its Component": fix("Extend only Languages in the scope of the Language's Component", "l"),
  "A Transformation's source is a Language its holder uses": fix("Make the holder use the source Language", "t"),
  "A Transformation's target is a Language its holder uses": fix("Make the holder use the target Language", "t"),
  "A Transformation's context is of its target's vocabulary": fix("Keep only Entities of the target Language's vocabulary as context", "t"),
  "A Relationship mapping requires both end Entities mapped": fix("Map the Entities at both ends of the Relationship first", "m"),
  "A Component imports only its siblings, or what a Component it is nested in imports": fix(
    "Import the Component into a Component this one is nested in first, or import only siblings",
    "c",
  ),
  "A Component imports a Transformation only from its siblings, or from what a Component it is nested in imports": fix(
    "Import the Transformation into a Component this one is nested in first, or import only siblings'",
    "c",
  ),
  "Entity mapping sources are in the source Language's vocabulary": fix("Map an Entity of the source Language's vocabulary", "m"),
  "Entity mapping targets are in the target Language's vocabulary": fix("Map to Entities of the target Language's vocabulary only", "m"),
  "Relationship mapping sources are in the source Language's vocabulary": fix("Map a Relationship of the source Language's vocabulary", "m"),
  "Relationship mapping targets are in the target Language's vocabulary": fix("Map to Relationships of the target Language's vocabulary only", "m"),
  "Target Relationships join images of the source Relationship's ends": fix("Map to Relationships joining the Entities the source Relationship's ends are mapped to", "m"),
  // Operations
  "An Interaction is over a Language its Component uses": fix("Make the Component use the Interaction's Language", "i"),
  "Parameter types are in the vocabulary of the Interaction's Language": fix("Type the Parameter with an Entity of the Interaction's Language's vocabulary", "p"),
  "The output is in the vocabulary of the Interaction's Language": fix("Make the output an Entity of the Interaction's Language's vocabulary", "i"),
  "A Component imports an Interaction only from its siblings, or from what a Component it is nested in imports": fix(
    "Import the Interaction into a Component this one is nested in first, or import only siblings'",
    "c",
  ),
  "An imported Interaction is over a Language the importer uses": fix("Make the Component use the imported Interaction's Language", "c"),
  // Deployment
  "An Instance is of a child of the deployed Component, or of a Component it imports": fix("Place only children of the deployed Component, or Components it imports", "i"),
  "No two Instances of a Deployment share a name": fix("Rename one of the two Instances", "a", "b"),
  "A Connection goes from an Instance of its own Deployment": fix("Connect from an Instance of the Connection's own Deployment", "c"),
  "A Connection goes to exactly one thing: an Instance, or the deployed Component": fix("Connect to exactly one thing: an Instance, or the deployed Component", "c"),
  "A Connection goes to an Instance of its own Deployment": fix("Connect to an Instance of the Connection's own Deployment", "c"),
  "A Connection to a Component goes to the deployed Component": fix("Connect to the deployed Component, or to one of its Instances", "c"),
  "The Instance a Connection goes to offers its What": fix("Connect to an Instance of the Component that offers the Interaction", "c"),
  "The deployed Component a Connection goes to offers or imports its What": fix("Make the deployed Component import the Interaction, or connect to an Instance that offers it", "c"),
  "A Connection's What is accessible to the Component it goes from": fix("Import the Interaction into the Component the Connection goes from", "c", "i"),
  "A Connection's What is over one Language": fix("Keep the Connection's What over one Language: split it", "c"),
  // Mediation
  "A Medium's call is an Interaction of the Component that defines it": fix("Choose a call among the Medium's own Component's Interactions", "m"),
  "A Medium's call is over the Medium's Language": fix("Choose a call over the Medium's Language", "m"),
  "A Component imports a Medium only from its siblings, or from what a Component it is nested in imports": fix(
    "Import the Medium into a Component this one is nested in first, or import only siblings'",
    "c",
  ),
  "A Mediation is over a Medium the deployed Component has access to": fix("Import the Medium, or the Component that defines it, into the deployed Component", "m", "k"),
  "A realization goes down into the Medium's Language": fix(REALIZE, "m"),
  "A realization comes up from the Medium's Language": fix(REALIZE, "m"),
  "The first Mediation's realization goes down from its Connection's What": fix(REALIZE, "m"),
  "The first Mediation's realization comes up to its Connection's What": fix(REALIZE, "m"),
  "A further Mediation's realization goes down from the call of the Medium below it": fix(REALIZE, "m"),
  "A further Mediation's realization comes up to the call of the Medium below it": fix(REALIZE, "m"),
  "A realization is accessible to the Component a Connection goes from": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization's way up is accessible to the Component a Connection goes from": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization is accessible to the Instance a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization's way up is accessible to the Instance a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization is accessible to the Component a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization's way up is accessible to the Component a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  // Configuration
  "A Configuration starts with a Deployment of its System's root": fix("Start the Configuration with a Deployment of the root", "c"),
  "A choice is for an Instance exactly when it is below another": fix("Choose for an Instance only below another choice", "h"),
  "A choice is for an Instance of the Deployment chosen above it": fix("Choose for an Instance of the Deployment chosen above", "h"),
  "A choice is of a Deployment of its Instance's Component": fix("Choose a Deployment of the Instance's own Component", "h"),
  "Each Instance is chosen for at most once under a choice": fix("Remove one of the two choices for the Instance", "a", "b"),
  // Std
  "An Action's primary Parameter is one of its own": fix("Choose one of the Interaction's own Parameters as primary, or none", "i"),
  "A comparison is an Interaction over its Entity's Language": fix("Choose an Interaction over the Entity's Language as its comparison", "e"),
  "A deferral names exactly one item": fix("Defer exactly one Entity or Relationship", "d"),
  "A deferred Entity is in the source Language's vocabulary": fix("Defer only items of the source Language's vocabulary", "d"),
  "A deferred Relationship is in the source Language's vocabulary": fix("Defer only items of the source Language's vocabulary", "d"),
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
