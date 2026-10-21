/**
 * ToolFormat: a System file, `systemathic/4` (docs/format.md). A file holds the design — the
 * System, its root and its packages, each Component in the core layers' formats — and the
 * attachments, opaque. This is where the layers are put together: each layer above Contexts
 * extends what the layers below it read and write.
 */
import { coreGraph, nameOf, setName } from "@systemathic/core";
import type { ToolSystem } from "@systemathic/tool";
import { readComponent, writeComponent, type ComponentJson, type Extension } from "./contexts-format.js";
import { deployment } from "./deployment-format.js";
import { mediations, mediums } from "./mediation-format.js";
import { array, FormatError, object, Reader, string, type LoadProblem } from "./reader.js";

export const FORMAT = "systemathic/4";

export interface AttachmentJson { owner: string; data: unknown }
export interface DesignJson { id: string; name: string; root: ComponentJson; packages: ComponentJson[] }
export interface SystemFile { format: typeof FORMAT; design: DesignJson; attachments: AttachmentJson[] }

/** Every layer above Contexts, in the order their keys are written. */
const layers: readonly Extension[] = [mediums, deployment([mediations])];

export interface ReadResult {
  readonly system: ToolSystem;
  /** Where the file could not be followed: references to nothing, duplicates. */
  readonly problems: readonly LoadProblem[];
}

/** Reads a parsed file. Throws FormatError if it is not a System file of this format. */
export function readSystem(value: unknown): ReadResult {
  const json = object(value, "$");
  if (json.format !== FORMAT) {
    const found = typeof json.format === "string" ? ` (this one is "${json.format}"; scripts/migrate.py brings "systemathic/2" and "systemathic/3" forward)` : "";
    throw new FormatError(`$.format: expected "${FORMAT}"${found}`);
  }
  const reader = new Reader(coreGraph());
  const design = object(json.design, "$.design");
  const system = reader.create("System", design.id, "$.design");
  if (system !== undefined) {
    setName(reader.graph, system, string(design.name, "$.design.name"));
    const root = readComponent(reader, design.root, "$.design.root", layers);
    if (root !== undefined) reader.graph.connect(system, "root", root);
    array(design.packages, "$.design.packages").forEach((value, index) => {
      const component = readComponent(reader, value, `$.design.packages[${index}]`, layers);
      if (component !== undefined) reader.graph.connect(system, "packages", component);
    });
  }
  reader.finish();
  const attachments = array(json.attachments, "$.attachments").map((value, index) => {
    const attachment = object(value, `$.attachments[${index}]`);
    return { owner: string(attachment.owner, `$.attachments[${index}].owner`), data: attachment.data };
  });
  return { system: { design: reader.graph, attachments }, problems: reader.problems };
}

export function writeSystem(system: ToolSystem): SystemFile {
  const graph = system.design;
  const [id] = graph.ofEntity("System");
  if (id === undefined) throw new Error("the design has no System");
  const [root] = graph.navigate(id, "root");
  if (root === undefined) throw new Error("the System has no root");
  return {
    format: FORMAT,
    design: {
      id,
      name: nameOf(graph, id) ?? "",
      root: writeComponent(graph, root, layers),
      packages: graph.navigate(id, "packages").map((component) => writeComponent(graph, component, layers)),
    },
    attachments: system.attachments.map(({ owner, data }) => ({ owner, data })),
  };
}
