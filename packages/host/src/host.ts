/**
 * Hosting (docs/tool-design.md, `Tool / Host`): where system contexts live. One Host is the
 * one authority for each of its system contexts: every Edit, from every session of every
 * client, is applied by it, in one order, and every subscriber is told of every Edit. A file
 * opened twice is one system context, so a UI and an LLM editing "the same file" edit the
 * same History.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { describe as describeElement, nameOf } from "@systemathic/core";
import { Catalog, exportSelection, importPackage, readPackage } from "@systemathic/catalog";
import { diagnose, structuralErrors, type Diagnostic } from "@systemathic/diagnoser";
import { Target, type Edit, type EditSession } from "@systemathic/editing";
import { ArgumentError, editors, findOperation } from "@systemathic/editors";
import { specify, toMarkdown } from "@systemathic/exporter";
import { perspectives, view, type Perspective, type View } from "@systemathic/perspectives";
import { PythonHost } from "@systemathic/python-host";
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

interface Hosted {
  readonly id: string;
  readonly target: Target;
  path?: string;
  run?: { run: Run; info: RunInfo };
  /** How many Edits the History had when it was last read from or written to its file. */
  saved: number;
}

export interface HostOptions {
  /** Where relative paths are resolved from. */
  readonly cwd?: string;
  readonly catalog?: Catalog;
  readonly scripts?: ScriptHost & ScriptAssistant;
}

export class Host implements HostApi {
  private readonly hosted = new Map<string, Hosted>();
  private readonly listeners = new Set<(event: HostEvent) => void>();
  private readonly cwd: string;
  private readonly library: Catalog;
  private readonly verifier: Verifier;
  private readonly scripts: ScriptHost & ScriptAssistant;
  private next = 1;

  constructor(options: HostOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.library = options.catalog ?? Catalog.standard();
    this.scripts = options.scripts ?? new PythonHost(undefined, this.cwd);
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
    const file = resolve(this.cwd, path);
    const already = [...this.hosted.values()].find((hosted) => hosted.path === file);
    if (already) return { ...this.info(already), problems: [] };
    let read;
    try {
      read = readSystem(JSON.parse(readFileSync(file, "utf8")));
    } catch (error) {
      if (error instanceof FormatError || error instanceof SyntaxError) throw new HostError(400, `${path}: not a System file: ${error.message}`);
      throw new HostError(404, `${path}: ${(error as Error).message}`);
    }
    const hosted = this.host(open(read.system), file);
    return { ...this.info(hosted), problems: read.problems };
  }

  async save(context: string, path?: string) {
    const hosted = this.get(context);
    const file = path === undefined ? hosted.path : resolve(this.cwd, path);
    if (file === undefined) throw new HostError(400, "this System has no file yet: save it to a path");
    writeFileSync(file, JSON.stringify(writeSystem(save(hosted.target.context)), null, 2) + "\n");
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
    const found: string[] = [];
    const walk = (dir: string, depth: number) => {
      for (const entry of readdirSync(join(this.cwd, dir), { withFileTypes: true })) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory() && depth < 4 && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist") walk(path, depth + 1);
        else if (entry.isFile() && entry.name.endsWith(".systemathic.json")) found.push(path);
      }
    };
    walk("", 0);
    return found.sort();
  }

  async select(context: string, session: string, ids: readonly string[]) {
    const target = this.get(context).target;
    const s = this.session(target, session);
    s.select(ids);
    return s.selection;
  }

  async importPackage(context: string, session: string, from: { package: string } | { path: string }) {
    const target = this.get(context).target;
    const p = "package" in from ? this.library.find(from.package) : readPackage(resolve(this.cwd, from.path));
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
      const profile = await this.verifier.profile({ path }, profileName ?? (script === undefined ? setting?.profile : undefined));
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
      const file = resolve(this.cwd, setting.script);
      const source = existsSync(file) ? readFileSync(file, "utf8") : undefined;
      return { path: setting.script, profile: setting.profile, source: source ?? TEMPLATE, exists: source !== undefined };
    }
    const beside = hosted.path ? posix(relative(this.cwd, hosted.path)).replace(/\.systemathic\.json$|\.json$/, ".rules.py") : "rules.py";
    return { path: beside, profile: "profile", source: TEMPLATE, exists: false };
  }

  async saveScript(context: string, path: string, source: string) {
    const hosted = this.get(context);
    const file = resolve(this.cwd, path);
    writeFileSync(file, source);
    const script = posix(relative(this.cwd, file));
    const current = profileSetting(hosted.target.context.attachments);
    await this.setAttachment(context, VERIFIER, { script, profile: current?.script === script ? current.profile : "profile" });
    return { path: script };
  }

  async checkScript(source: string): Promise<ScriptCheck> {
    const folder = mkdtempSync(join(tmpdir(), "systemathic-script-"));
    try {
      const file = join(folder, "script.py");
      writeFileSync(file, source);
      return await this.scripts.check({ path: file });
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
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
    const where = resolve(this.cwd, path);
    writeFileSync(where, JSON.stringify(file, null, 2) + "\n");
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

/** A path with forward slashes, as files name each other in a System's attachments. */
const posix = (path: string) => path.split(sep).join("/");

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
