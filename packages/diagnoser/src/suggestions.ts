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
const REALIZATION_ACCESS = "Import the realization into the Connection's Deployment, from the Component that exports it: it is the Deployment's, not the ends'";

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
  "A Component imports only vocabulary: its Imports take only Languages": fix(
    "Move the Import to a Deployment of the Component: a box imports the Languages its interface is written in, and what calls is a Deployment, which imports what it needs",
    "c",
    "e",
  ),
  // Deployment
  "An Instance's min <= max, where max is present": fix("Make the Instance's min at most its max", "i"),
  "An Instance is of a box in its Deployment's scope: a child of its box or of the box's ancestors, a child of its keeper or of the keeper's ancestors, or a top-level Component the Deployment imports": fix(
    "Place a box in the Deployment's scope: a child of its box or keeper, or of theirs, or a top-level Component the Deployment imports",
    "i",
  ),
  "An Instance runs only a Deployment of its own box": fix("Run a Deployment of the Instance's own box, or leave the choice to the Configuration", "i", "r"),
  "No two Instances of a Deployment share a name": fix("Rename one of the two Instances", "a", "b"),
  "A Deployment kept outside its box imports the box": fix("Import the box into the Deployment", "d"),
  "A Connection goes from an Instance of its own Deployment": fix("Connect from an Instance of the Connection's own Deployment", "c"),
  "A Connection goes to exactly one thing: an Instance, an identity, or the Deployment's box": fix("Connect to exactly one thing: an Instance, an identity, or the Deployment's box", "c"),
  "A Connection goes to an Instance of its own Deployment": fix("Connect to an Instance of the Connection's own Deployment", "c"),
  "A Connection to a Component goes to the Deployment's box": fix("Connect to the Deployment's box, to one of its Instances, or to an identity it imports", "c"),
  "A Connection to an identity goes to one its Deployment imports": fix("Import the identity into the Connection's Deployment, or connect to one it imports", "c", "m"),
  "The Instance a Connection goes to offers its What: its own, or one of an API it exports": fix("Connect to an Instance of a box that offers the Interaction, or exports an API that does", "c"),
  "The box a Connection goes out through offers its What, or the Deployment imports it": fix("Make the Deployment import the Interaction, or connect to an Instance that offers it", "c", "i"),
  "The identity a Connection goes to offers its What": fix("Connect to an identity whose box offers the Interaction", "c", "m"),
  "An Import belongs to exactly one Component or Deployment": fix("Keep the Import in one Component or one Deployment", "m"),
  "An Import is from a Component, or is an identity": fix("Make the Import either from a Component, or a path of placements, not both", "m"),
  "An identity takes no Exports": fix("Take no Exports in an identity: it is an object, relied on as its interface", "m"),
  "Only a Deployment imports an identity": fix("Move the identity to a Deployment: a box imports only vocabulary", "m"),
  "Each Step after the first is placed in a Deployment of the box the Step before it is of": fix("Make each step a placement in a Deployment of the box the step before it is of", "s", "n"),
  "Each Step is a placement its Deployment exposes": fix("Expose the placement in its Deployment, or take another path", "s"),
  "An Export belongs to exactly one Component or Deployment": fix("Keep the Export in one Component or one Deployment", "e"),
  "A Deployment exposes only placements, its own": fix("Expose only a placement of the Deployment itself", "e", "x"),
  "Only a Deployment exposes a placement": fix("Move the Export of a placement to the Deployment that places it", "e"),
  "An Export of a placement exports nothing else": fix("Make the Export export one thing: split it", "e"),
  "An Export of a Deployment exports nothing else": fix("Make the Export export one thing: split it", "e"),
  "A Component exports only Deployments it keeps": fix("Export the Deployment from the Component that keeps it", "e", "d"),
  "A Connection's What is over one Language": fix("Keep the Connection's What over one Language: split it", "c"),
  // Mediation
  "A Medium's call is an Interaction of the Component that defines it": fix("Choose a call among the Medium's own Component's Interactions", "m"),
  "A Medium's call is over the Medium's Language": fix("Choose a call over the Medium's Language", "m"),
  "An Export of a Medium exports nothing else": fix("Make the Export export one thing: split it", "e"),
  "An Export has a target": fix("Make the Export export something, or remove it", "e"),
  "A Component exports only its own Mediums": fix("Export the Medium from the Component that defines it", "e", "x"),
  "A Mediation is over a Medium its Connection's Deployment has access to": fix("Import the Medium into the Connection's Deployment, from the Component that exports it", "m", "d"),
  "A realization goes down into the Medium's Language": fix(REALIZE, "m"),
  "A realization comes up from the Medium's Language": fix(REALIZE, "m"),
  "The top Mediation's realization goes down from its Connection's What": fix(REALIZE, "m"),
  "The top Mediation's realization comes up to its Connection's What": fix(REALIZE, "m"),
  "A lower Mediation's realization goes down from the Medium above it": fix(REALIZE, "m"),
  "A lower Mediation's realization comes up to the Medium above it": fix(REALIZE, "m"),
  "A realization's way down is accessible to its Connection's Deployment": fix(REALIZATION_ACCESS, "d", "t"),
  "A realization's way up is accessible to its Connection's Deployment": fix(REALIZATION_ACCESS, "d", "t"),
  // Systems
  "A System's root and packages are not nested": fix("Take the package out of the Component it is nested in", "c"),
  "A System's root is not one of its packages": fix("Remove the root from the System's packages", "s"),
  "Every Component is nested, or is the root or a package of a System": fix("Nest the Component in another, or bring it in as a package", "c"),
  "An identity starts at a placement in a Deployment of the System's root": fix("Start the identity at a placement in a Deployment of the System's root", "f"),
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
