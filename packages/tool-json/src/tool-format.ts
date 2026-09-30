/**
 * ToolFormat: `Tool::System / JSON`. A file holds the design, in the core layers' formats, and
 * the attachments, opaque. This is where the layers are put together: Operations extends
 * what Contexts reads and writes.
 */
import { coreGraph } from "@systemathic/core";
import type { ToolSystem } from "@systemathic/tool";
import { readDesign, writeDesign, type DesignJson, type Extension } from "./contexts-format.js";
import {
  readInteractionMappings,
  readInteractions,
  writeInteractionMappings,
  writeInteractions,
  type InteractionJson,
  type InteractionMappingJson,
} from "./operations-format.js";
import { array, FormatError, object, Reader, string, type LoadProblem } from "./reader.js";

export const FORMAT = "systemathic/1";

export interface AttachmentJson { owner: string; data: unknown }
export interface SystemFile { format: typeof FORMAT; design: DesignJson; attachments: AttachmentJson[] }

const operations: Extension = {
  readLanguage: (reader, language, json, at) => readInteractions(reader, language, json.interactions, `${at}.interactions`),
  writeLanguage: (graph, language) => ({ interactions: writeInteractions(graph, language) satisfies InteractionJson[] }),
  readTransformation: (reader, transformation, json, at) =>
    readInteractionMappings(reader, transformation, json.interactionMappings, `${at}.interactionMappings`),
  writeTransformation: (graph, transformation) => ({
    interactionMappings: writeInteractionMappings(graph, transformation) satisfies InteractionMappingJson[],
  }),
};

export interface ReadResult {
  readonly system: ToolSystem;
  /** Where the file could not be followed: references to nothing, duplicates. */
  readonly problems: readonly LoadProblem[];
}

/** Reads a parsed file. Throws FormatError if it is not a System file of this format. */
export function readSystem(value: unknown): ReadResult {
  const json = object(value, "$");
  if (json.format !== FORMAT) throw new FormatError(`$.format: expected "${FORMAT}"`);
  const reader = new Reader(coreGraph());
  readDesign(reader, json.design, "$.design", [operations]);
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
    design: writeDesign(system.design, root, [operations]),
    attachments: system.attachments.map(({ owner, data }) => ({ owner, data })),
  };
}
