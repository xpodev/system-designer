/** What Std owns: a Transformation its deferrals, each of which exists only while its item does. */
import { composition } from "../kernel/removal.js";

export const stdComposition = composition({ Transformation: ["deferred"] }, ["Deferred"]);
