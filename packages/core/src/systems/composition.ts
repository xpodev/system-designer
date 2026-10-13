/** What Systems owns: a System its root and its packages. */
import { composition } from "../kernel/removal.js";

export const systemsComposition = composition({ System: ["root", "packages"] }, []);
