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
  "A Component uses only Languages in its scope: its own and its parents', and those of the Components it imports": fix(
    "Import the Component that defines the Language, or stop using it",
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
  "A nested Component imports only its siblings, or what a Component it is nested in imports": fix(
    "Import the Component into a Component this one is nested in first, or import only siblings",
    "c",
  ),
  "A nested Component imports an Interaction only from its siblings, or from what a Component it is nested in imports": fix(
    "Import the Interaction into a Component this one is nested in first, or import only siblings'",
    "c",
  ),
  "A nested Component imports a Transformation only from its siblings, or from what a Component it is nested in imports": fix(
    "Import the Transformation into a Component this one is nested in first, or import only siblings'",
    "c",
  ),
  "An imported Interaction is over a Language the importer uses": fix("Make the Component use the imported Interaction's Language", "c"),
  "No Component implements itself, eventually": fix("Stop one of the Components in the cycle implementing the next", "c"),
  "A Component imports what it implements": fix("Import the Component it implements", "c", "x"),
  "A Component uses the Language of every Interaction of what it implements": fix("Use the Language of the implemented Component's Interaction", "c", "i"),
  // Deployment
  "An Instance's min <= max, where max is present": fix("Make the Instance's min at most its max", "i"),
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
  "A nested Component imports a Medium only from its siblings, or from what a Component it is nested in imports": fix(
    "Import the Medium into a Component this one is nested in first, or import only siblings'",
    "c",
  ),
  "A Mediation is over a Medium the deployed Component has access to": fix("Import the Medium, or the Component that defines it, into the deployed Component", "m", "k"),
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
  "The root imports only packages": fix("Import only the System's packages into the root", "k"),
  "A package imports only other packages": fix("Import only other packages into a package", "c", "k"),
  "The root imports Interactions only from packages": fix("Import into the root only Interactions of packages", "i"),
  "A package imports Interactions only from other packages": fix("Import into a package only other packages' Interactions", "c", "i"),
  "The root imports Transformations only from packages": fix("Import into the root only Transformations of packages", "t"),
  "A package imports Transformations only from other packages": fix("Import into a package only other packages' Transformations", "c", "t"),
  "The root imports Mediums only from packages": fix("Import into the root only Mediums of packages", "m"),
  "A package imports Mediums only from other packages": fix("Import into a package only other packages' Mediums", "c", "m"),
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
