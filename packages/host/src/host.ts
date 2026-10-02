/**
 * Hosting (docs/tool-design.md, `Tool / Host`): where system contexts live. One Host is the
 * one authority for each of its system contexts: every Edit, from every session of every
 * client, is applied by it, in one order, and every subscriber is told of every Edit. A file
 * opened twice is one system context, so a UI and an LLM editing "the same file" edit the
 * same History.
 *
 * Where it lives is not its business: files, the catalog and the script host are given to it.
 * A local process gives it the disk and Python (@systemathic/host-node); a browser tab gives it
 * the browser's storage and Python in WebAssembly (@systemathic/host-browser).
 */
import { describe as describeElement, nameOf } from "@systemathic/core";
import { exportSelection, importPackage, parsePackage, type Catalog } from "@systemathic/catalog";
import { diagnose, structuralErrors, type Diagnostic } from "@systemathic/diagnoser";
import { Target, type Edit, type EditSession } from "@systemathic/editing";
import { ArgumentError, editors, findOperation } from "@systemathic/editors";
import { specify, toMarkdown } from "@systemathic/exporter";
import { perspectives, view, type Perspective, type View } from "@systemathic/perspectives";
import { newSystem, open, save, type SystemContext } from "@systemathic/tool";
import { FormatError, readSystem, writeSystem, type SystemFile } from "@systemathic/tool-json";
import {
  ATTACHMENT_OWNER as VERIFIER,
  profileSetting,
  snapshot,
  STANDARD,
  Verifier,
  type Run,
  type ScriptAssistant,
  type ScriptCheck,
  type ScriptHost,
  type ScriptSymbol,
} from "@systemathic/verifier";
import { HostError, type ContextInfo, type EditInfo, type HostApi, type HostEvent, type OperationInfo, type PackageSummary, type RunInfo } from "./api.js";

/**
 * The files a Host reads and writes: Systems, scripts, packages. Paths are relative to the
 * Host's workspace, with forward slashes; `resolve` gives the one form two names of the same
 * file share.
 */
export interface Files {
  resolve(path: string): string;
  /** A file's text; undefined if there is none. */
  read(path: string): Promise<string | undefined>;
  write(path: string, text: string): Promise<void>;
  /** The files whose names end with `suffix`, sorted. */
  list(suffix: string): Promise<string[]>;
}

interface Hosted {
  readonly id: string;
  readonly target: Target;
  path?: string;
  run?: { run: Run; info: RunInfo };
  /** How many Edits the History had when it was last read from or written to its file. */
  saved: number;
}

export interface HostOptions {
  readonly files: Files;
  readonly catalog: Catalog;
  readonly scripts: ScriptHost & ScriptAssistant;
}

export class Host implements HostApi {
  private readonly hosted = new Map<string, Hosted>();
  private readonly listeners = new Set<(event: HostEvent) => void>();
  private readonly store: Files;
  private readonly library: Catalog;
  private readonly verifier: Verifier;
  private readonly scripts: ScriptHost & ScriptAssistant;
  private next = 1;

  constructor(options: HostOptions) {
    this.store = options.files;
    this.library = options.catalog;
    this.scripts = options.scripts;
    this.verifier = new Verifier(this.scripts);
  }

  async editors(): Promise<OperationInfo[]> {
    return Object.values(editors).flatMap((operations) =>
      operations.map(({ editor, name, about, kind, parameters }) => ({ editor, name, about, kind, parameters })),
    );
  }

  async perspectives() {
    return [...perspectives];
  }

  async catalog(text?: string, tag?: string): Promise<PackageSummary[]> {
    return this.library.search(text, tag).map(({ id, name, about, tags, origin }) => ({ id, name, about, tags, origin }));
  }

  async contexts(): Promise<ContextInfo[]> {
    return [...this.hosted.values()].map((hosted) => this.info(hosted));
  }

  async create(name: string): Promise<ContextInfo> {
    return this.info(this.host(newSystem(name)));
  }

  async open(path: string) {
    const file = this.store.resolve(path);
    const already = [...this.hosted.values()].find((hosted) => hosted.path === file);
    if (already) return { ...this.info(already), problems: [] };
    const text = await this.store.read(file);
    if (text === undefined) throw new HostError(404, `${path}: no such file`);
    let read;
    try {
      read = readSystem(JSON.parse(text));
    } catch (error) {
      if (error instanceof FormatError || error instanceof SyntaxError) throw new HostError(400, `${path}: not a System file: ${error.message}`);
      throw error;
    }
    const hosted = this.host(open(read.system), file);
    return { ...this.info(hosted), problems: read.problems };
  }

  async save(context: string, path?: string) {
    const hosted = this.get(context);
    const file = path === undefined ? hosted.path : this.store.resolve(path);
    if (file === undefined) throw new HostError(400, "this System has no file yet: save it to a path");
    await this.store.write(file, JSON.stringify(writeSystem(save(hosted.target.context)), null, 2) + "\n");
    hosted.path = file;
    hosted.saved = hosted.target.history.edits.length;
    this.emit({ type: "contexts" });
    this.emit({ type: "saved", context, path: file });
    return { path: file };
  }

  async startSession(context: string, client: string) {
    const session = this.get(context).target.startSession(client).id;
    this.emit({ type: "contexts" });
    return { session };
  }

  async endSession(context: string, session: string) {
    const target = this.get(context).target;
    target.endSession(this.session(target, session));
    this.emit({ type: "contexts" });
  }

  async apply(context: string, session: string, editor: string, name: string, args: Record<string, unknown>): Promise<EditInfo> {
    const target = this.get(context).target;
    const operation = findOperation(editor, name);
    if (!operation) throw new HostError(404, `no operation ${editor}.${name}`);
    try {
      return this.edit(target, operation.run(this.session(target, session), args));
    } catch (error) {
      if (error instanceof ArgumentError) throw new HostError(400, `${editor}.${name}: ${error.message}`);
      throw error;
    }
  }

  async undo(context: string, session: string) {
    const target = this.get(context).target;
    const edit = target.undo(this.session(target, session));
    return edit === undefined ? null : this.edit(target, edit);
  }

  async redo(context: string, session: string) {
    const target = this.get(context).target;
    const edit = target.redo(this.session(target, session));
    return edit === undefined ? null : this.edit(target, edit);
  }

  async files(): Promise<string[]> {
    return this.store.list(".systemathic.json");
  }

  async select(context: string, session: string, ids: readonly string[]) {
    const target = this.get(context).target;
    const s = this.session(target, session);
    s.select(ids);
    return s.selection;
  }

  async importPackage(context: string, session: string, from: { package: string } | { path: string }) {
    const target = this.get(context).target;
    const p = "package" in from ? this.library.find(from.package) : await this.packageFile(from.path);
    if (!p) throw new HostError(404, `no package ${"package" in from ? from.package : from.path}`);
    const result = importPackage(this.session(target, session), p);
    this.emit({ type: "attachments", context, owner: "catalog" });
    return { edits: result.edits.map((edit) => this.edit(target, edit)), reused: result.reused };
  }

  async system(context: string): Promise<SystemFile> {
    return writeSystem(save(this.get(context).target.context));
  }

  async history(context: string): Promise<EditInfo[]> {
    const target = this.get(context).target;
    return target.history.edits.map((edit) => this.edit(target, edit));
  }

  async diagnostics(context: string): Promise<Diagnostic[]> {
    const hosted = this.get(context);
    return diagnose(hosted.target.context, hosted.run?.run);
  }

  async view(context: string, perspective: string, language?: string): Promise<View> {
    if (!perspectives.some((p) => p.perspective === perspective)) throw new HostError(404, `no perspective '${perspective}'`);
    const hosted = this.get(context);
    if (perspective === "language" && (language === undefined || !hosted.target.graph.has(language))) {
      throw new HostError(400, "the Language perspective needs the id of a Language");
    }
    const options = { diagnostics: diagnose(hosted.target.context, hosted.run?.run), ...(language === undefined ? {} : { language }) };
    return view(hosted.target.context, perspective as Perspective, options);
  }

  /** Verifies a Snapshot; structural errors block it (docs/tool-design.md, Obligations). */
  async verify(context: string, script?: string, profileName?: string): Promise<RunInfo> {
    const hosted = this.get(context);
    const errors = structuralErrors(diagnose(hosted.target.context));
    if (errors.length > 0) throw new HostError(409, `${errors.length} structural error(s) must be solved before verifying`);
    const setting = profileSetting(hosted.target.context.attachments);
    const path = script ?? setting?.script ?? STANDARD.path;
    let run: Run;
    try {
      const source = path === STANDARD.path ? undefined : await this.store.read(path);
      if (path !== STANDARD.path && source === undefined) throw new Error(`there is no script ${path}`);
      const profile = await this.verifier.profile(source === undefined ? { path } : { path, source }, profileName ?? (script === undefined ? setting?.profile : undefined));
      run = await this.verifier.verify(snapshot(hosted.target.context), profile);
    } catch (error) {
      throw new HostError(400, `cannot verify: ${(error as Error).message}`);
    }
    const errorsFound = run.violations.filter((v) => v.rule.severity === "error").length;
    const info: RunInfo = {
      profile: run.profile.name,
      script: path,
      atEdit: hosted.target.history.edits.length,
      rules: run.profile.rules.length,
      errors: errorsFound,
      warnings: run.violations.length - errorsFound,
      violations: run.violations.map((v) => ({ rule: v.rule.name, severity: v.rule.severity, message: v.message, subjects: v.subjects })),
      failures: run.failures,
    };
    hosted.run = { run, info };
    this.emit({ type: "verified", context, run: info });
    return info;
  }

  async script(context: string) {
    const hosted = this.get(context);
    const setting = profileSetting(hosted.target.context.attachments);
    if (setting && setting.script !== STANDARD.path) {
      const source = await this.store.read(setting.script);
      return { path: setting.script, profile: setting.profile, source: source ?? TEMPLATE, exists: source !== undefined };
    }
    const beside = hosted.path ? hosted.path.replace(/\.systemathic\.json$|\.json$/, ".rules.py") : "rules.py";
    return { path: beside, profile: "profile", source: TEMPLATE, exists: false };
  }

  async saveScript(context: string, path: string, source: string) {
    const hosted = this.get(context);
    const script = this.store.resolve(path);
    await this.store.write(script, source);
    const current = profileSetting(hosted.target.context.attachments);
    await this.setAttachment(context, VERIFIER, { script, profile: current?.script === script ? current.profile : "profile" });
    return { path: script };
  }

  async checkScript(source: string): Promise<ScriptCheck> {
    return this.scripts.check(source);
  }

  async symbols(): Promise<ScriptSymbol[]> {
    return this.scripts.symbols();
  }

  async specification(context: string) {
    const hosted = this.get(context);
    const errors = structuralErrors(diagnose(hosted.target.context));
    if (errors.length > 0) throw new HostError(409, `${errors.length} structural error(s) must be solved before exporting`);
    const specification = specify(hosted.target.context, hosted.run?.run.profile);
    return { specification, markdown: toMarkdown(specification) };
  }

  async exportSelection(context: string, ids: readonly string[], name: string, path?: string) {
    const content = exportSelection(this.get(context).target.context, ids, { name });
    const file = writeSystem(content);
    if (path === undefined) return { file };
    const where = this.store.resolve(path);
    await this.store.write(where, JSON.stringify(file, null, 2) + "\n");
    return { path: where, file };
  }

  async setAttachment(context: string, owner: string, data: unknown) {
    const system = this.get(context).target.context;
    for (const attachment of system.attachments.filter((a) => a.owner === owner)) system.detach(attachment);
    if (data !== null && data !== undefined) system.attach({ owner, data });
    this.emit({ type: "attachments", context, owner });
  }

  async attachment(context: string, owner: string) {
    return this.get(context).target.context.attachments.find((a) => a.owner === owner)?.data ?? null;
  }

  subscribe(listener: (event: HostEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** How an Element reads, for messages. */
  describe(context: string, id: string): string {
    return describeElement(this.get(context).target.graph, id);
  }

  private async packageFile(path: string) {
    const text = await this.store.read(path);
    if (text === undefined) return undefined;
    try {
      return parsePackage(JSON.parse(text), "file", path);
    } catch (error) {
      throw new HostError(400, `${path}: ${(error as Error).message}`);
    }
  }

  private host(context: SystemContext, path?: string): Hosted {
    const id = `c${this.next++}`;
    const target = new Target(context);
    const hosted: Hosted = path === undefined ? { id, target, saved: 0 } : { id, target, path, saved: 0 };
    target.onEdit((edit) => this.emit({ type: "edit", context: id, edit: this.edit(target, edit) }));
    this.hosted.set(id, hosted);
    this.emit({ type: "contexts" });
    return hosted;
  }

  private get(context: string): Hosted {
    const hosted = this.hosted.get(context);
    if (!hosted) throw new HostError(404, `no system context ${context}`);
    return hosted;
  }

  private session(target: Target, id: string): EditSession {
    const session = target.session(id);
    if (!session) throw new HostError(404, `no session ${id}`);
    return session;
  }

  private info(hosted: Hosted): ContextInfo {
    const { target } = hosted;
    const [system] = target.graph.ofEntity("System");
    return {
      id: hosted.id,
      name: (system && nameOf(target.graph, system)) ?? hosted.id,
      ...(hosted.path === undefined ? {} : { path: hosted.path }),
      edits: target.history.edits.length,
      sessions: target.sessionCount,
      clients: target.activeSessions.map((session) => session.client),
      dirty: target.history.edits.length !== hosted.saved,
      structuralErrors: structuralErrors(diagnose(target.context)).length,
    };
  }

  private edit(target: Target, edit: Edit): EditInfo {
    const { id, kind, author, summary, elements, reverts } = edit;
    const client = target.client(author) ?? author;
    return reverts === undefined ? { id, kind, author, client, summary, elements } : { id, kind, author, client, summary, elements, reverts };
  }

  private emit(event: HostEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

/** A new System's verification script: the standard rules, and one of its own to start from. */
const TEMPLATE = `"""The rules this System is verified against."""

from systemathic.core import *
from systemathic.std import *


@rule(severity=ERROR)
def every_domain_uses_a_language(system: System):
    """Every Domain uses at least one Language of its own."""
    for domain in system.domains:
        if not domain.languages:
            yield Violation(domain, f"{domain.name} uses no Language of its own")


profile = Profile(*standard_rules, every_domain_uses_a_language)
`;
