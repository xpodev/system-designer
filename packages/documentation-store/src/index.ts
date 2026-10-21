/**
 * The Documentation Store (docs/system-designer.md): Documentation's Metadata Provider, and its
 * Edit Kind. Its Descriptions are kept in its attachment, beside the design.
 *
 * Describing is an Edit like any other: it is on the one History, told to every session, and
 * undone and redone with the rest, because its Effect knows how to revert itself.
 */
import { ATTACHMENT_OWNER, SUBJECTS, describable, kept, type Stored } from "@systemathic/documentation";
import type { Effect, Edit, EditSession } from "@systemathic/editing";
import { ArgumentError, type Operation } from "@systemathic/editors";
import type { MetadataProvider, SystemContext } from "@systemathic/tool";

/**
 * Documentation as a Metadata Provider. Its Descriptions are kept in its attachment, so there is
 * nothing to load; what it saves leaves out the Descriptions of Subjects no longer there, kept
 * only so undo can bring them back.
 */
export const documentationProvider: MetadataProvider = {
  async load() {},
  async save(system) {
    const data = system.attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<Stored> | undefined;
    if (typeof data?.descriptions !== "object" || data.descriptions === null) return;
    const present = Object.fromEntries(Object.entries(data.descriptions).filter(([id]) => describable(system, id)));
    for (const attachment of system.attachments.filter((a) => a.owner === ATTACHMENT_OWNER)) system.detach(attachment);
    if (Object.keys(present).length > 0) system.attach({ owner: ATTACHMENT_OWNER, data: { ...data, descriptions: present } });
  },
};

/** Sets the Description of `subject`, or removes it; the Effect says how to put back what was there. */
function write(context: SystemContext, subject: string, text: string | undefined): Effect {
  const all = { ...kept(context.attachments) };
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
    about: "Describes something in the System — the System itself, a Component, Language, Entity, Relationship, Formula, Interaction, Transformation, Medium, Deployment, Instance or Connection: what it is and what it is for, in prose. Empty text removes the description.",
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
