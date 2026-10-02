/**
 * The RuleHost in WebAssembly: the same `systemathic` Python package, run by Pyodide. It answers
 * what `python -m systemathic.host` answers — describe, run, check, symbols — with scripts and
 * Systems handed to it as text, since there is no disk to read them from. It runs in a Web
 * Worker in a browser, or in Node.
 */
import { loadPyodide, type PyodideInterface } from "pyodide";

/** The `systemathic` package's modules, by file name: `core.py`, `std.py`, … */
export type PythonSources = Readonly<Record<string, string>>;

const PACKAGE = "/systemathic-lib/systemathic";
const WORK = "/systemathic-work";

export type Request =
  | { readonly method: "describe"; readonly script?: string }
  | { readonly method: "run"; readonly script?: string; readonly system: string; readonly profile: string }
  | { readonly method: "check"; readonly script: string }
  | { readonly method: "symbols" };

export class RuleRunner {
  private constructor(private readonly py: PyodideInterface) {}

  /** Loads Python, and the `systemathic` package from `sources`. `indexURL` is where Pyodide's own files are, in a browser. */
  static async load(sources: PythonSources, indexURL?: string): Promise<RuleRunner> {
    const py = await loadPyodide(indexURL === undefined ? {} : { indexURL });
    py.FS.mkdirTree(PACKAGE);
    py.FS.mkdirTree(WORK);
    for (const [name, text] of Object.entries(sources)) py.FS.writeFile(`${PACKAGE}/${name}`, text);
    py.runPython(`import sys\nsys.path.insert(0, "${PACKAGE.slice(0, PACKAGE.lastIndexOf("/"))}")\nimport json\nfrom systemathic import assist, host`);
    return new RuleRunner(py);
  }

  /** Answers one request, as the command-line RuleHost would: a JSON text. */
  answer(request: Request): string {
    const call = (code: string) => String(this.py.runPython(`json.dumps(${code})`));
    try {
      switch (request.method) {
        case "describe":
          return call(`host.describe(${this.script(request.script)})`);
        case "run": {
          this.py.FS.writeFile(`${WORK}/system.systemathic.json`, request.system);
          return call(`host.run(${this.script(request.script)}, ${JSON.stringify(`${WORK}/system.systemathic.json`)}, ${JSON.stringify(request.profile)})`);
        }
        case "check":
          return call(`assist.check(${this.script(request.script)})`);
        case "symbols":
          return call(`{"symbols": assist.symbols()}`);
      }
    } catch (error) {
      // What Python raised, as the RuleHost reports it: its last line, the error itself.
      const lines = String((error as Error).message ?? error).trim().split("\n");
      return JSON.stringify({ error: lines.at(-1) });
    }
  }

  /** A script by its source, written where Python can import it; `std` without one. */
  private script(source: string | undefined): string {
    if (source === undefined) return JSON.stringify("std");
    // A fresh file each time, so a changed script is loaded anew rather than taken from a cache.
    const path = `${WORK}/script_${(this.count = (this.count ?? 0) + 1)}.py`;
    this.py.FS.writeFile(path, source);
    return JSON.stringify(path);
  }

  private count?: number;
}
