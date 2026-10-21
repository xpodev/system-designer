/**
 * Documentation (docs/system-designer.md): what a System and the things in it are for, in
 * prose. It is metadata, not part of the design: the core knows nothing of it, and nothing in a
 * design depends on it. The things it describes are its Subjects, by id — the System, its
 * Components, Languages, Entities, Relationships, Formulas, Interactions, Transformations,
 * Mediums, Deployments, Instances and Connections — and their Descriptions are kept with the
 * System, in the Documentation Store's attachment. This is the reading of them, for anyone;
 * describing is the Store's (`@systemathic/documentation-store`).
 */
import type { SystemContext, ToolSystem } from "@systemathic/tool";

/** Who the attachment the Descriptions are kept in belongs to. */
export const ATTACHMENT_OWNER = "documentation";

/** The Entities of the core whose instances can be described: the projection core → Documentation, `↦ Subject`. */
export const SUBJECTS: ReadonlySet<string> = new Set([
  "System",
  "Component",
  "Language",
  "Entity",
  "Relationship",
  "Formula",
  "Interaction",
  "Transformation",
  "Medium",
  "Deployment",
  "Instance",
  "Connection",
]);

/** The attachment's data. */
export interface Stored {
  readonly descriptions: Readonly<Record<string, string>>;
}

/** Every Description kept, by its Subject's id, including those of Subjects no longer there, so undoing a removal brings back its Description too. */
export function kept(attachments: ToolSystem["attachments"]): Readonly<Record<string, string>> {
  const data = attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<Stored> | undefined;
  const descriptions = data?.descriptions;
  if (typeof descriptions !== "object" || descriptions === null) return {};
  return Object.fromEntries(Object.entries(descriptions).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Whether `id` is something that can be described, in this context. */
export function describable(context: SystemContext, id: string): boolean {
  return context.design.has(id) && SUBJECTS.has(context.design.get(id).entity);
}

/** The Descriptions of the things in the System, by id. */
export function descriptions(context: SystemContext): ReadonlyMap<string, string> {
  return new Map(Object.entries(kept(context.attachments)).filter(([id]) => describable(context, id)));
}

/** The Description of `id`, if it has one. */
export function descriptionOf(context: SystemContext, id: string): string | undefined {
  return describable(context, id) ? kept(context.attachments)[id] : undefined;
}
