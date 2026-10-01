/** JsonExport (docs/tool-design.md, `Exporter / JSON`): a Specification as JSON, for a machine; by value. */
import type { Specification } from "./specification.js";

export const SPEC_FORMAT = "systemathic-specification/1";

export interface SpecificationFile extends Specification {
  readonly format: typeof SPEC_FORMAT;
}

export function toJson(specification: Specification): SpecificationFile {
  return { format: SPEC_FORMAT, ...specification };
}

export function fromJson(value: unknown): Specification {
  const file = value as Partial<SpecificationFile> | null;
  if (file?.format !== SPEC_FORMAT) throw new Error(`not a specification: expected "format": "${SPEC_FORMAT}"`);
  const { format: _format, ...specification } = file as SpecificationFile;
  return specification;
}
