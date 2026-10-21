/**
 * The Log: who did what to a System, and when, kept with it — if the System keeps one. A
 * System keeps no Log until it is told to (`keep`), and stops, forgetting it, when told so.
 * It is an Edit Listener: told of every Edit on a Target whose System keeps a Log, it writes an
 * Entry for it into its own attachment, which is stored with the design — so the Log goes on
 * across saves and reopenings, while the History, and with it undo, ends with the Target. An
 * Entry is a record, not an Edit: it names its client, not a session, and nothing in it is
 * needed to read it back.
 *
 * Writing an Entry, or keeping a Log at all, is not itself an Edit: the Log is about the
 * History, not on it.
 */
import type { Edit, Target } from "@systemathic/editing";
import type { SystemContext } from "@systemathic/tool";

/** Who the attachment the Log is kept in belongs to. */
export const ATTACHMENT_OWNER = "log";

export interface Entry {
  /** When the Edit was made, as an ISO 8601 date and time. */
  readonly at: string;
  /** The client of the session that made it: `ui`, `mcp`, … */
  readonly client: string;
  /** Whether it was made, undid an Edit, or did an undone one again. */
  readonly role: "do" | "undo" | "redo";
  readonly kind: Edit["kind"];
  readonly summary: string;
  /** Ids of what it touched, as they were then. */
  readonly elements: readonly string[];
}

interface Stored {
  readonly entries: readonly Entry[];
}

/** Whether the System keeps a Log. */
export function keeping(context: SystemContext): boolean {
  return context.attachments.some((attachment) => attachment.owner === ATTACHMENT_OWNER);
}

/** Every Entry of the Log, oldest first; none if the System keeps no Log. */
export function entries(context: SystemContext): readonly Entry[] {
  const data = context.attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<Stored> | undefined;
  return Array.isArray(data?.entries) ? data.entries : [];
}

function write(context: SystemContext, stored: Stored | undefined): void {
  for (const attachment of context.attachments.filter((a) => a.owner === ATTACHMENT_OWNER)) context.detach(attachment);
  if (stored !== undefined) context.attach({ owner: ATTACHMENT_OWNER, data: stored });
}

/** Makes the System keep a Log, from now on, or stop keeping one and forget what it held. */
export function keep(context: SystemContext, keep: boolean): void {
  if (keep === keeping(context)) return;
  write(context, keep ? { entries: [] } : undefined);
}

/** Adds an Entry to the Log of `context`, if it keeps one. */
export function record(context: SystemContext, entry: Entry): void {
  if (keeping(context)) write(context, { entries: [...entries(context), entry] });
}

/** Connects the Log to `target`: from now on, every Edit on it is recorded while its System keeps a Log. Gives back how to disconnect it. */
export function log(target: Target, now: () => Date = () => new Date()): () => void {
  return target.onEdit((edit) =>
    record(target.context, {
      at: now().toISOString(),
      client: target.client(edit.author) ?? edit.author,
      role: target.role(edit),
      kind: edit.kind,
      summary: edit.summary,
      elements: edit.elements,
    }),
  );
}
