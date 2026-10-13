/**
 * What Contexts owns: a Component its children, Languages, Interactions and Transformations.
 * An Interaction exists only while its Language does. A Transformation without an output stays,
 * ill-formed, for the diagnoser to show.
 */
import { composition } from "../kernel/removal.js";

export const contextsComposition = composition(
  {
    Component: ["components", "languages", "interactions", "transformations"],
  },
  [],
  { Interaction: [["language"]] },
);
