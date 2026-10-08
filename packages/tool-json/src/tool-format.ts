/**
 * ToolFormat: `Tool::System / JSON`. A file holds the design, in the core layers' formats, and
 * the attachments, opaque. This is where the layers are put together: each layer above
 * Contexts extends what the layers below it read and write, and Std extends Operations and
 * Contexts.
 */
import { systemGraph } from "@systemathic/core";
import type { ToolSystem } from "@systemathic/tool";
import { configurations } from "./configuration-format.js";
import { readDesign, writeDesign, type DesignJson, type Extension } from "./contexts-format.js";
import { deployment } from "./deployment-format.js";
import { mediations, mediums } from "./mediation-format.js";
import { operations } from "./operations-format.js";
import { array, FormatError, object, Reader, string, type LoadProblem } from "./reader.js";
import { stdInteractions, stdTransformations } from "./std-format.js";

export const FORMAT = "systemathic/2";

/** The format of the previous model, which cannot be read into this one. */
const PREVIOUS = "systemathic/1";

export interface AttachmentJson { owner: string; data: unknown }
export interface SystemFile { format: typeof FORMAT; design: DesignJson; attachments: AttachmentJson[] }

/** Every layer above Contexts, in the order their keys are written. */
const layers: readonly Extension[] = [operations([stdInteractions]), mediums, deployment([mediations]), configurations, stdTransformations];

export interface ReadResult {
  readonly system: ToolSystem;
  /** Where the file could not be followed: references to nothing, duplicates. */
  readonly problems: readonly LoadProblem[];
}

/** Reads a parsed file. Throws FormatError if it is not a System file of this format. */
export function readSystem(value: unknown): ReadResult {
  const json = object(value, "$");
  if (json.format === PREVIOUS) {
    throw new FormatError(`$.format: this file is in the previous model ("${PREVIOUS}"), which Systemathic no longer reads; it cannot be opened`);
  }
  if (json.format !== FORMAT) throw new FormatError(`$.format: expected "${FORMAT}"`);
  const reader = new Reader(systemGraph());
  readDesign(reader, json.design, "$.design", layers);
  reader.finish();
  const attachments = array(json.attachments, "$.attachments").map((value, index) => {
    const attachment = object(value, `$.attachments[${index}]`);
    return { owner: string(attachment.owner, `$.attachments[${index}].owner`), data: attachment.data };
  });
  return { system: { design: reader.graph, attachments }, problems: reader.problems };
}

export function writeSystem(system: ToolSystem): SystemFile {
  const [root] = system.design.ofEntity("System");
  if (root === undefined) throw new Error("the design has no System");
  return {
    format: FORMAT,
    design: writeDesign(system.design, root, layers),
    attachments: system.attachments.map(({ owner, data }) => ({ owner, data })),
  };
}
