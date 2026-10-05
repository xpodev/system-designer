/**
 * Documentation (docs/tool-design.md): what a System and the things in it are for, in prose. It
 * is a tool context, not part of the design: the core knows nothing of it, and nothing in a
 * design depends on it. The things it describes are its Subjects, by id — the System, its
 * Languages, Entities, Relationships, Formulas, Interactions, Domains, Transformations and
 * Mediations — and it keeps their Descriptions with the System, as its own attachment.
 *
 * Describing is an Edit like any other: it is on the one History, told to every session, and
 * undone and redone with the rest, because its Effect knows how to revert itself.
 */
import type { Effect, Edit, EditSession } from "@systemathic/editing";
import { ArgumentError, type Operation } from "@systemathic/editors";
import type { SystemContext } from "@systemathic/tool";

/** Who the attachment the Descriptions are kept in belongs to. */
export const ATTACHMENT_OWNER = "documentation";

/** The Entities of the core whose instances can be described: the projection core → Documentation, `↦ Subject`. */
export const SUBJECTS: ReadonlySet<string> = new Set(["System", "Language", "Entity", "Relationship", "Formula", "Interaction", "Domain", "Transformation", "Mediation"]);

interface Stored {
  readonly descriptions: Readonly<Record<string, string>>;
}

/** Every Description kept, by its Subject's id, including those of Subjects no longer there, so undoing a removal brings back its Description too. */
function stored(context: SystemContext): Readonly<Record<string, string>> {
  const data = context.attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<Stored> | undefined;
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
  return new Map(Object.entries(stored(context)).filter(([id]) => describable(context, id)));
}

/** The Description of `id`, if it has one. */
export function descriptionOf(context: SystemContext, id: string): string | undefined {
  return describable(context, id) ? stored(context)[id] : undefined;
}

/** Sets the Description of `subject`, or removes it; the Effect says how to put back what was there. */
function write(context: SystemContext, subject: string, text: string | undefined): Effect {
  const all = { ...stored(context) };
  const before = all[subject];
  if (text === undefined) delete all[subject];
  else all[subject] = text;
  for (const attachment of context.attachments.filter((a) => a.owner === ATTACHMENT_OWNER)) context.detach(attachment);
  if (Object.keys(all).length > 0) context.attach({ owner: ATTACHMENT_OWNER, data: { descriptions: all } satisfies Stored });
  return { touched: [subject], revert: () => write(context, subject, before) };
}

/**
 * `describe(EditSession, Subject, text) → Edit`: what `subject` is and what it is for, in prose
 * (a little Markdown). Empty text, or only whitespace, removes its Description.
 */
export function describe(session: EditSession, subject: string, text: string): Edit {
  const context = session.target.context;
  if (!describable(context, subject)) throw new ArgumentError(`${subject} is not something that can be described`);
  const value = text.trim() === "" ? undefined : text.trim();
  const what = context.design.get(subject).entity;
  return session.record("change", `${value === undefined ? "undescribe" : "describe"} ${what}`, [subject], () => write(context, subject, value));
}

/** The DocumentationEditor's operations, as data, for clients to be built from. */
export const documentationEditor: readonly Operation[] = [
  {
    editor: "DocumentationEditor",
    name: "describe",
    kind: "change",
    about: "Describes something in the System — the System itself, a Language, Entity, Relationship, Formula, Interaction, Domain, Transformation or Mediation: what it is and what it is for, in prose. Empty text removes the description.",
    parameters: [
      { name: "subject", kind: "element", of: [...SUBJECTS], about: "what is described" },
      { name: "text", kind: "text", about: "the description, in prose (a little Markdown); empty to remove it" },
    ],
    run(session, args) {
      if (typeof args.subject !== "string") throw new ArgumentError(`subject: expected the id of something to describe, got ${JSON.stringify(args.subject)}`);
      if (typeof args.text !== "string") throw new ArgumentError(`text: expected text, got ${JSON.stringify(args.text)}`);
      return describe(session, args.subject, args.text);
    },
  },
];
