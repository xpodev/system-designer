/**
 * The UI as the static site has it: the host in the page itself, with no server. Files are kept
 * in memory here rather than in IndexedDB, and Python runs in this thread rather than a Worker;
 * everything else is the site's own.
 */
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { browserHost, MemoryStore, pythonSources } from "@systemathic/host-browser";
import { InProcess, RuleRunner } from "@systemathic/pyodide-host";
import { JSDOM } from "jsdom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const globals = globalThis as Record<string, unknown>;
for (const key of Object.getOwnPropertyNames(dom.window)) if (!(key in globalThis)) globals[key] = (dom.window as unknown as Record<string, unknown>)[key];
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");
const { App } = await import("../src/App");
const { useHost } = await import("../src/api");

const store = new MemoryStore();
const pyodideFolder = dirname(createRequire(import.meta.url).resolve("pyodide/package.json")) + "/";

beforeAll(async () => {
  dom.window.Element.prototype.scrollIntoView = () => undefined;
  useHost(await browserHost({ store, channel: new InProcess(RuleRunner.load(pythonSources, pyodideFolder)) }), "browser");
});
afterEach(() => cleanup());

describe("the UI, standing alone in the browser", () => {
  it("welcomes a new visitor with the examples kept in this browser", async () => {
    window.history.replaceState(null, "", "#");
    render(<App />);
    await screen.findByText(/your Systems are kept in this browser/);
    expect(await screen.findByText("tool-design.systemathic.json")).toBeTruthy();
  });

  it("opens an example, edits it, verifies it in Python in WebAssembly, and keeps it", async () => {
    window.history.replaceState(null, "", "#");
    render(<App />);
    fireEvent.click(await screen.findByText("game.systemathic.json"));
    await waitFor(() => expect(document.querySelector(".explorer")).not.toBeNull(), { timeout: 5000 });
    fireEvent.click(await screen.findByText("Verify", { selector: ".health-card button" }));
    await screen.findByText("0 rule errors, 1 warning", {}, { timeout: 60_000 });

    const languages = [...document.querySelectorAll<HTMLElement>(".explorer .tree-row.group")].find((row) => row.textContent?.startsWith("Languages"))!;
    fireEvent.click(languages.querySelector(".row-add")!);
    await waitFor(() => expect(document.querySelector(".editor-header h1")?.textContent).toBe("NewLanguage"));
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    await screen.findByText("Saved game.systemathic.json");
    const kept = JSON.parse((await store.get("examples/game.systemathic.json"))!);
    expect(kept.design.languages.map((l: { name: string }) => l.name)).toContain("NewLanguage");
  }, 90_000);

  it("brings a System in from the computer", async () => {
    window.history.replaceState(null, "", "#");
    render(<App />);
    fireEvent.click(await screen.findByText("Open a file…"));
    const input = document.querySelector<HTMLInputElement>(".upload-row input[type=file]")!;
    const file = { name: "shop.systemathic.json", format: "systemathic/1", design: { id: "shop", name: "Shop", languages: [], domains: [], mediations: [] }, attachments: [] };
    const { name, ...content } = file;
    Object.defineProperty(input, "files", { value: [new dom.window.File([JSON.stringify(content)], name)] });
    fireEvent.change(input);
    await waitFor(() => expect(document.querySelector(".editor-header h1")?.textContent).toBe("Shop"), { timeout: 5000 });
    expect(await store.get("shop.systemathic.json")).toBeTruthy();
  });
});
