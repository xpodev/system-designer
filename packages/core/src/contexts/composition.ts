/**
 * What Contexts owns: a Component its children, Languages, Interactions, Transformations,
 * Exports and Imports. An Interaction exists only while its Language does. What an Import
 * requires is said by Deployment, which adds identities: Imports of no Component. An Import that loses an Export keeps the rest. A
 * Transformation without an output stays, ill-formed, for the diagnoser to show. What an Export
 * requires is said by Mediation, which adds the last thing it can refer to.
 */
import { composition } from "../kernel/removal.js";

export const contextsComposition = composition(
  {
    Component: ["components", "languages", "interactions", "transformations", "exports", "imports"],
  },
  [],
  { Interaction: [["language"]] },
);
