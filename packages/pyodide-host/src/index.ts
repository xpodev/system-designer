/**
 * RuleHost in WebAssembly (docs/tool-design.md, `Verifier / Python`): the Verifier's script host
 * where there is no Python to start, as in a browser. Scripts cross by value, as their source;
 * Snapshots as System files. The runner can be in this thread or, in a browser, in a Web Worker,
 * so that a long rule does not freeze the page and one that never ends can be stopped.
 */
import { writeSystem } from "@systemathic/tool-json";
import type { Failure, HostRun, Profile, Rule, Script, ScriptAssistant, ScriptCheck, ScriptHost, ScriptSymbol, Snapshot } from "@systemathic/verifier";
import type { Request, RuleRunner } from "./runner.js";

export { RuleRunner, type PythonSources, type Request } from "./runner.js";

/** How requests reach a runner, and its JSON answers come back. */
export interface Channel {
  ask(request: Request): Promise<string>;
}

/** A runner in this thread. */
export class InProcess implements Channel {
  constructor(private readonly runner: Promise<RuleRunner>) {}

  async ask(request: Request): Promise<string> {
    return (await this.runner).answer(request);
  }
}

/** What a runner in a Worker is sent, and sends back. */
export type WorkerMessage = { readonly id: number; readonly request: Request };
export type WorkerReply = { readonly id: number; readonly answer: string } | { readonly ready: true };

/**
 * A runner in a Web Worker, made by `start`. A request that takes longer than `timeout` stops
 * the Worker — the rule may never end — and the next request starts a new one.
 */
export class InWorker implements Channel {
  private worker?: Worker;
  private next = 1;
  private readonly waiting = new Map<number, { done(answer: string): void; fail(error: Error): void; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly start: () => Worker,
    private readonly timeout = 60_000,
  ) {}

  ask(request: Request): Promise<string> {
    const worker = this.ensure();
    const id = this.next++;
    return new Promise((done, fail) => {
      const timer = setTimeout(() => {
        this.stop(new Error(`the rules ran for more than ${Math.round(this.timeout / 1000)} seconds, and were stopped`));
      }, this.timeout);
      this.waiting.set(id, { done, fail, timer });
      worker.postMessage({ id, request } satisfies WorkerMessage);
    });
  }

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const worker = this.start();
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if ("ready" in event.data) return;
      const pending = this.waiting.get(event.data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.waiting.delete(event.data.id);
      pending.done(event.data.answer);
    };
    worker.onerror = (event) => this.stop(new Error(`Python could not start: ${event.message}`));
    this.worker = worker;
    return worker;
  }

  private stop(error: Error): void {
    this.worker?.terminate();
    this.worker = undefined;
    for (const pending of this.waiting.values()) {
      clearTimeout(pending.timer);
      pending.fail(error);
    }
    this.waiting.clear();
  }
}

interface Described {
  rules: Rule[];
  profiles: { name: string; rules: string[]; severities?: Record<string, Rule["severity"]> }[];
}

interface Ran {
  violations: { rule: string; severity: string; message: string; subjects: string[] }[];
  failures: Failure[];
}

export class PyodideScripts implements ScriptHost, ScriptAssistant {
  private symbolsOnce?: Promise<ScriptSymbol[]>;

  constructor(private readonly channel: Channel) {}

  async profiles(script: Script): Promise<Profile[]> {
    const described = await this.call<Described>({ method: "describe", ...this.source(script) });
    const rules = new Map(described.rules.map((rule) => [rule.name, rule]));
    return described.profiles.map((profile) => ({
      name: profile.name,
      script,
      rules: profile.rules
        .map((name) => rules.get(name))
        .filter((rule) => rule !== undefined)
        .map((rule) => ({ ...rule, severity: profile.severities?.[rule.name] ?? rule.severity })),
    }));
  }

  async run(profile: Profile, snapshot: Snapshot): Promise<HostRun> {
    const system = JSON.stringify(writeSystem(snapshot.system));
    const ran = await this.call<Ran>({ method: "run", ...this.source(profile.script), system, profile: profile.name });
    return { violations: ran.violations, failures: ran.failures };
  }

  check(source: string): Promise<ScriptCheck> {
    return this.call<ScriptCheck>({ method: "check", script: source });
  }

  symbols(): Promise<ScriptSymbol[]> {
    this.symbolsOnce ??= this.call<{ symbols: ScriptSymbol[] }>({ method: "symbols" }).then((r) => r.symbols);
    return this.symbolsOnce;
  }

  private source(script: Script): { script?: string } {
    if (script.path === "std") return {};
    if (script.source === undefined) throw new Error(`the script ${script.path} came without its source`);
    return { script: script.source };
  }

  private async call<T>(request: Request): Promise<T> {
    const answer = JSON.parse(await this.channel.ask(request)) as T & { error?: string };
    if (answer.error) throw new Error(answer.error);
    return answer;
  }
}
