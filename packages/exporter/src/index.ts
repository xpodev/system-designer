/**
 * The Exporter (docs/tool-design.md): a design as a Specification, and the Specification in
 * representations fit for different validators. `Exporter / Markdown` and `Exporter / JSON`
 * are the same "what" over two "hows": the Specification does not depend on its
 * representation, and each representation reads back into it.
 */
export { specify, type Obligation, type ObligationKind, type Requirement, type Section, type Specification, type Statement } from "./specification.js";
export { fromMarkdown, MarkdownError, toMarkdown } from "./markdown.js";
export { fromJson, SPEC_FORMAT, toJson, type SpecificationFile } from "./json.js";
