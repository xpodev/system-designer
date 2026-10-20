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
const REALIZATION_ACCESS = "Import the realization into the Component at this end of the Connection, from a Component that exports it";

/** By the axiom's `about`, which is unique among the core's axioms. */
const byAxiom: Readonly<Record<string, Suggest>> = {
  // Kernel
  "Relationship ends are in the vocabulary of the Relationship's Language": fix(
    "Put an Entity of the Language's vocabulary at this end, or make the Language extend the one this Entity is in",
    "e",
  ),
  "An Entity extends only Entities of the Languages its Language extends": fix("Make the Entity's Language extend the Language of what it extends, or extend another Entity", "e"),
  "min <= max, where max is present": fix("Make the end's min at most its max", "e"),
  "In every Language, from any Entity, the named ends reachable across its vocabulary, its own and those of what it extends, have distinct names": fix(
    "Rename one of the two ends",
    "a",
    "b",
  ),
  "No Language extends itself, eventually": fix("Stop one of the Languages in the cycle extending the next", "l"),
  "No Entity extends itself, eventually": fix("Stop one of the Entities in the cycle extending the next", "e"),
  // Contexts
  "No Component is nested in itself, eventually": fix("Move the Component out of its own nesting", "c"),
  "A Component uses only Languages in its scope: its own and its parents', and those it imports": fix(
    "Import the Language from the Component that exports it, or stop using it",
    "c",
    "l",
  ),
  "A Language extends only Languages in the scope of its Component": fix("Extend only Languages in the scope of the Language's Component", "l"),
  "A Transformation's inputs are all of one Language": fix("Type every input of the Transformation with an Entity of one Language", "t"),
  "A Transformation has an output": fix("Give the Transformation an output, of another Language than its inputs", "t"),
  "A Transformation's output is of a Language other than its inputs'": fix(
    "Make the output an Entity of another Language than the inputs': within one Language, it is an Interaction",
    "t",
  ),
  "A Transformation's inputs are in the vocabulary of a Language its Component uses": fix("Make the Component use the inputs' Language", "t"),
  "A Transformation's output is in the vocabulary of a Language its Component uses": fix("Make the Component use the output's Language", "t"),
  "An Interaction is over a Language its Component uses": fix("Make the Component use the Interaction's Language", "i"),
  "Parameter types are in the vocabulary of the Interaction's Language": fix("Type the Parameter with an Entity of the Interaction's Language's vocabulary", "p"),
  "The output is in the vocabulary of the Interaction's Language": fix("Make the output an Entity of the Interaction's Language's vocabulary", "i"),
  "An Export of a child exports nothing else": fix("Make the Export export one thing: split it", "e"),
  "An Export of an Interaction exports nothing else": fix("Make the Export export one thing: split it", "e"),
  "An Export of a Transformation exports nothing else": fix("Make the Export export one thing: split it", "e"),
  "A Component exports only its own children": fix("Export the Component from its parent", "e", "k"),
  "A Component exports only its own Interactions": fix("Export the Interaction from its own Component", "e", "i"),
  "A Component exports only its own Transformations": fix("Export the Transformation from its own Component", "e", "t"),
  "A Component exports only its own Languages": fix("Export the Language from its own Component", "e", "l"),
  "An Import takes only Exports of the Component it is from": fix("Take the Export in an Import from its own Component", "m", "e"),
  "An imported Interaction is over a Language the importer uses": fix("Make the Component use the imported Interaction's Language", "c"),
  "No Component implements itself, eventually": fix("Stop one of the Components in the cycle implementing the next", "c"),
  "A Component imports what it implements": fix("Import the Component it implements", "c", "x"),
  "A Component uses the Language of every Interaction that what it implements exports": fix("Use the Language of the implemented Component's Interaction", "c", "i"),
  // Deployment
  "An Instance's min <= max, where max is present": fix("Make the Instance's min at most its max", "i"),
  "An Instance is of a child of the deployed Component, or of a Component it imports": fix("Place only children of the deployed Component, or Components it imports", "i"),
  "An Instance of a Component from beyond what the deployed Component's ancestors hold is of one its parent exports": fix("Export the placed Component from its parent", "i"),
  "No two Instances of a Deployment share a name": fix("Rename one of the two Instances", "a", "b"),
  "A Connection goes from an Instance of its own Deployment": fix("Connect from an Instance of the Connection's own Deployment", "c"),
  "A Connection goes to exactly one thing: an Instance, or the deployed Component": fix("Connect to exactly one thing: an Instance, or the deployed Component", "c"),
  "A Connection goes to an Instance of its own Deployment": fix("Connect to an Instance of the Connection's own Deployment", "c"),
  "A Connection to a Component goes to the deployed Component": fix("Connect to the deployed Component, or to one of its Instances", "c"),
  "The Instance a Connection goes to offers its What: its own, or one of an API it exports": fix("Connect to an Instance of a Component that offers or exports the Interaction", "c"),
  "The deployed Component a Connection goes to offers or imports its What": fix("Make the deployed Component import the Interaction, or connect to an Instance that offers it", "c"),
  "A Connection's What is accessible to the Component it goes from": fix("Import the Interaction into the Component the Connection goes from, from a Component that exports it", "c", "i"),
  "A Connection's What is over one Language": fix("Keep the Connection's What over one Language: split it", "c"),
  // Mediation
  "A Medium's call is an Interaction of the Component that defines it": fix("Choose a call among the Medium's own Component's Interactions", "m"),
  "A Medium's call is over the Medium's Language": fix("Choose a call over the Medium's Language", "m"),
  "An Export of a Medium exports nothing else": fix("Make the Export export one thing: split it", "e"),
  "An Export has a target": fix("Make the Export export something, or remove it", "e"),
  "A Component exports only its own Mediums": fix("Export the Medium from the Component that defines it", "e", "x"),
  "A Mediation is over a Medium the deployed Component has access to": fix("Import the Medium into the deployed Component, from a Component that exports it", "m", "k"),
  "A realization goes down into the Medium's Language": fix(REALIZE, "m"),
  "A realization comes up from the Medium's Language": fix(REALIZE, "m"),
  "The top Mediation's realization goes down from its Connection's What": fix(REALIZE, "m"),
  "The top Mediation's realization comes up to its Connection's What": fix(REALIZE, "m"),
  "A lower Mediation's realization goes down from the Medium above it": fix(REALIZE, "m"),
  "A lower Mediation's realization comes up to the Medium above it": fix(REALIZE, "m"),
  "A realization is accessible to the Component a Connection goes from": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization's way up is accessible to the Component a Connection goes from": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization is accessible to the Instance a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization's way up is accessible to the Instance a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization is accessible to the Component a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  "A realization's way up is accessible to the Component a Connection goes to": fix(REALIZATION_ACCESS, "k", "t"),
  // Systems
  "A System's root and packages are not nested": fix("Take the package out of the Component it is nested in", "c"),
  "A System's root is not one of its packages": fix("Remove the root from the System's packages", "s"),
  "Every Component is nested, or is the root or a package of a System": fix("Nest the Component in another, or bring it in as a package", "c"),
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
