/** What Operations owns: a Component its Interactions, an Interaction its Parameters. Each exists only while what it is typed by does. */
import { composition } from "../kernel/removal.js";

export const operationsComposition = composition(
  {
    Component: ["interactions"],
    Interaction: ["parameters"],
  },
  [],
  { Interaction: [["language"]], Parameter: [["type"]] },
);
