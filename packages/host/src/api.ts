/**
 * What every client sees of the host: system contexts, edit sessions on them, the editors'
 * operations, points of view, diagnostics, verification, export and the catalog. The same
 * interface is served in-process (`Host`) and over HTTP (`HostClient`), so a client does not
 * know where the system context lives.
 */
import type { Diagnostic } from "@systemathic/diagnoser";
import type { Documentation, Specification } from "@systemathic/exporter";
import type { ParameterSpec } from "@systemathic/editors";
import type { PerspectiveInfo, View } from "@systemathic/perspectives";
import type { SystemFile } from "@systemathic/tool-json";
import type { ScriptCheck, ScriptSymbol } from "@systemathic/verifier";

export interface ContextInfo {
  readonly id: string;
  readonly name: string;
  /** The file it was opened from or last saved to. */
  readonly path?: string;
  readonly edits: number;
  readonly sessions: number;
  /** The clients editing it now, one per session: `ui`, `mcp`, … */
  readonly clients: readonly string[];
  /** Whether it has Edits its file does not have yet. */
  readonly dirty: boolean;
  readonly structuralErrors: number;
}

export interface OperationInfo {
  readonly editor: string;
  readonly name: string;
  readonly about: string;
  readonly kind: "addition" | "change" | "removal";
  readonly parameters: readonly ParameterSpec[];
}

export interface EditInfo {
  readonly id: number;
  readonly kind: "addition" | "change" | "removal";
  readonly author: string;
  readonly client: string;
  readonly summary: string;
  readonly elements: readonly string[];
  readonly reverts?: number;
}

export interface PackageSummary {
  readonly id: string;
  readonly name: string;
  readonly about: string;
  readonly tags: readonly string[];
  readonly origin: "standard" | "file";
}

/** A rule of a profile, with its documentation. */
export interface RuleInfo {
  readonly name: string;
  readonly severity: "error" | "warning";
  readonly about: string;
  readonly doc?: string;
  readonly script: string;
}

export interface RunInfo {
  readonly profile: string;
  readonly script: string;
  /** The profile's rules; an older host leaves them out. */
  readonly profileRules?: readonly RuleInfo[];
  /** How many Edits the History had when the Snapshot was taken. */
  readonly atEdit: number;
  readonly rules: number;
  readonly errors: number;
  readonly warnings: number;
  readonly violations: readonly { rule: string; severity: "error" | "warning"; message: string; subjects: readonly string[] }[];
  readonly failures: readonly { rule: string; error: string; line?: number }[];
}

export type HostEvent =
  | { readonly type: "edit"; readonly context: string; readonly edit: EditInfo }
  | { readonly type: "verified"; readonly context: string; readonly run: RunInfo }
  | { readonly type: "attachments"; readonly context: string; readonly owner: string }
  | { readonly type: "saved"; readonly context: string; readonly path: string }
  | { readonly type: "contexts" };

export interface HostApi {
  editors(): Promise<OperationInfo[]>;
  perspectives(): Promise<PerspectiveInfo[]>;
  catalog(text?: string, tag?: string): Promise<PackageSummary[]>;

  contexts(): Promise<ContextInfo[]>;
  /** The System files under the host's folder, by path relative to it. */
  files(): Promise<string[]>;
  /** Puts a file in the host's folder — one a person brought from elsewhere — and says where it is. */
  writeFile(path: string, text: string): Promise<{ path: string }>;
  /** `new() → SystemContext` */
  create(name: string): Promise<ContextInfo>;
  /** `open(System) → SystemContext`; a file open already is the same system context. */
  open(path: string): Promise<ContextInfo & { problems: readonly { at: string; message: string }[] }>;
  /** `save(SystemContext) → System`, to its own file or to `path`. */
  save(context: string, path?: string): Promise<{ path: string }>;

  startSession(context: string, client: string): Promise<{ session: string }>;
  endSession(context: string, session: string): Promise<void>;
  apply(context: string, session: string, editor: string, operation: string, args: Record<string, unknown>): Promise<EditInfo>;
  undo(context: string, session: string): Promise<EditInfo | null>;
  redo(context: string, session: string): Promise<EditInfo | null>;
  select(context: string, session: string, ids: readonly string[]): Promise<readonly string[]>;
  importPackage(context: string, session: string, from: { package: string } | { path: string }): Promise<{ edits: EditInfo[]; reused: readonly string[] }>;

  system(context: string): Promise<SystemFile>;
  history(context: string): Promise<EditInfo[]>;
  diagnostics(context: string): Promise<Diagnostic[]>;
  view(context: string, perspective: string, language?: string): Promise<View>;
  verify(context: string, script?: string, profile?: string): Promise<RunInfo>;
  specification(context: string): Promise<{ specification: Specification; markdown: string }>;
  /** The System written up for people, with every Description, and the rules it was last verified against. */
  documentation(context: string): Promise<{ documentation: Documentation; markdown: string }>;

  /** The System's verification script: its own, or a new one to start from, with where it is (or would be) saved. */
  script(context: string): Promise<{ path: string; profile: string; source: string; exists: boolean }>;
  /** Saves a script, relative to the host's folder, and makes it the one the System is verified against. */
  saveScript(context: string, path: string, source: string): Promise<{ path: string }>;
  /** What is wrong with a script's source, as it is being written. */
  checkScript(source: string): Promise<ScriptCheck>;
  /** What a script can use. */
  symbols(): Promise<ScriptSymbol[]>;
  exportSelection(context: string, ids: readonly string[], name: string, path?: string): Promise<{ path?: string; file: SystemFile }>;
  /** Replaces the attachment of an owner — a client's layouts — or removes it, with `null`. */
  setAttachment(context: string, owner: string, data: unknown): Promise<void>;
  attachment(context: string, owner: string): Promise<unknown>;

  /** Every event of every context, in order. */
  subscribe(listener: (event: HostEvent) => void): () => void;
}

/** A failure a client caused: what it asked for does not exist, or is not allowed now. */
export class HostError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
