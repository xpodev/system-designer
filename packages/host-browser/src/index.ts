/**
 * Hosting in a browser tab (docs/tool-design.md, `Tool / Host`): the Host in the page, for one
 * person, with nothing to install and nothing on a server. Systems and scripts are kept in this
 * browser; the catalog is built in; rules run in Python compiled to WebAssembly, in a Web Worker.
 */
import { Host } from "@systemathic/host";
import { InWorker, PyodideScripts, type Channel } from "@systemathic/pyodide-host";
import { exampleFiles, standardCatalog } from "./bundled.js";
import { BrowserFiles, IndexedDbStore, type Store } from "./files.js";

export { BrowserFiles, IndexedDbStore, MemoryStore, normalize, type Store } from "./files.js";
export { exampleFiles, pythonSources, standardCatalog } from "./bundled.js";

/** Rules run in a Web Worker, with Pyodide's files at `pyodideURL`. */
export function workerChannel(pyodideURL: string, timeout?: number): Channel {
  return new InWorker(() => {
    const worker = new Worker(new URL("./python.worker.js", import.meta.url), { type: "module" });
    worker.postMessage({ init: pyodideURL });
    return worker;
  }, timeout);
}

export interface BrowserHostOptions {
  /** Where files are kept; the browser's IndexedDB by default. */
  readonly store?: Store;
  /** How rules reach Python; a Web Worker by default, with Pyodide's files beside the page. */
  readonly channel?: Channel;
}

/** A Host in this page. A store with nothing in it yet is given the examples to start from. */
export async function browserHost(options: BrowserHostOptions = {}): Promise<Host> {
  const store = options.store ?? new IndexedDbStore();
  if ((await store.paths()).length === 0) {
    for (const [path, text] of Object.entries(exampleFiles)) await store.set(path, text);
  }
  const channel = options.channel ?? workerChannel(new URL("pyodide/", document.baseURI).href);
  return new Host({ files: new BrowserFiles(store), catalog: standardCatalog(), scripts: new PyodideScripts(channel) });
}
