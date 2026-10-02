/**
 * The Web Worker that runs rules: Python in WebAssembly, off the page's thread. It is told
 * where Pyodide's files are first, then answers requests one by one.
 */
import { RuleRunner, type Request, type WorkerMessage, type WorkerReply } from "@systemathic/pyodide-host";
import { pythonSources } from "./bundled.js";

let runner: Promise<RuleRunner> | undefined;

self.onmessage = async (event: MessageEvent<WorkerMessage | { init: string }>) => {
  if ("init" in event.data) {
    runner = RuleRunner.load(pythonSources, event.data.init);
    await runner;
    self.postMessage({ ready: true } satisfies WorkerReply);
    return;
  }
  const { id, request } = event.data as { id: number; request: Request };
  const answer = runner ? (await runner).answer(request) : JSON.stringify({ error: "Python was not started" });
  self.postMessage({ id, answer } satisfies WorkerReply);
};
