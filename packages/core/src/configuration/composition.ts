/**
 * What Configuration owns: a System its Configurations, a Configuration its first choice,
 * a choice the choices beneath it. A choice exists only while its Deployment does, and — below
 * the first — its Instance.
 */
import { composition } from "../kernel/removal.js";

export const configurationComposition = composition(
  {
    System: ["configurations"],
    Configuration: ["root"],
    Choice: ["choices"],
  },
  [],
  { Choice: [["deployment"], ["instance"]] },
);
