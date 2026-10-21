/**
 * The UI against a real host: what a person does — open a System, open its editors, edit in
 * place — and what they should see. The browser is jsdom; the host is the real one, over HTTP.
 *
 * jsdom is installed by hand on Node's globals, rather than as Vitest's environment, which would
 * rewrite the host's `new URL(…, import.meta.url)` into web addresses.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HostClient, type Host } from "@systemathic/host";
import { nodeHost, serve } from "@systemathic/host-node";
import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
const globals = globalThis as Record<string, unknown>;
for (const key of Object.getOwnPropertyNames(dom.window)) if (!(key in globalThis)) globals[key] = (dom.window as unknown as Record<string, unknown>)[key];
for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

const { act, cleanup, fireEvent, render, screen, waitFor, within } = await import("@testing-library/react");
const { App } = await import("../src/App");

const root = fileURLToPath(new URL("../../../", import.meta.url));
let url: string;
let host: Host;
let close: () => void;
/** Where the host runs, and the game as the tests start from it. */
let dir: string;
let game: unknown;

/** The host's event stream, as EventSource gives it to the page. */
class HostEventSource {
  onmessage?: (message: { data: string }) => void;
  onopen?: () => void;
  onerror?: () => void;
  private readonly stop: () => void;
  constructor() {
    this.stop = new HostClient(url).subscribe((event) => this.onmessage?.({ data: JSON.stringify(event) }));
    setTimeout(() => this.onopen?.(), 0);
  }
  close() {
    this.stop();
  }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "systemathic-ui-"));
  // The example, without whatever layout a person left in it while using the UI.
  const file = JSON.parse(readFileSync(join(root, "examples/game.systemathic.json"), "utf8"));
  file.attachments = file.attachments.filter((a: { owner: string }) => a.owner !== "ui");
  game = file;
  writeFileSync(join(dir, "game.systemathic.json"), JSON.stringify(file));
  host = nodeHost({ cwd: dir });
  const served = await serve(host, { port: 0 });
  url = served.url;
  close = () => served.server.close();
  const real = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => real(new URL(String(input), url), init)) as typeof fetch;
  globals.EventSource = HostEventSource;
  dom.window.Element.prototype.scrollIntoView = () => undefined;
});
afterAll(() => close?.());
afterEach(() => cleanup());

/** Opens the game — a fresh copy of it, under `name`, for a test that leaves it changed. */
async function openGame(name = "game.systemathic.json") {
  if (name !== "game.systemathic.json") writeFileSync(join(dir, name), JSON.stringify(game));
  const { id } = await host.open(name);
  window.history.replaceState(null, "", `#${id}`);
  render(<App />);
  await waitFor(() => expect(document.querySelector(".explorer")).not.toBeNull(), { timeout: 5000 });
  // Let the page's event stream connect, so it hears of what other clients do from here on.
  await new Promise((done) => setTimeout(done, 150));
  return id;
}

const explorerRow = (label: string) =>
  [...document.querySelectorAll<HTMLElement>(".explorer .tree-row")].find((row) => row.querySelector(".tree-label")?.textContent === label)!;

/** The editor's title, once it shows `name`. */
async function editorTitled(name: string): Promise<HTMLElement> {
  return waitFor(() => {
    const h1 = document.querySelector(".editor-header h1");
    expect(h1?.textContent).toBe(name);
    return h1!.closest(".editor") as HTMLElement;
  });
}

/** Opens a Component's "more" menu item on a row. */
function menuItem(row: HTMLElement, label: string): void {
  fireEvent.click(within(row).getByRole("button", { name: "More" }));
  fireEvent.click(within(row).getByText(label));
}

const root0 = (file: { design: { root: { languages: { entities: { name: string }[]; relationships: { id: string; ends: { name: string | null }[] }[] }[] } } }) => file.design.root;

describe("the UI", () => {
  it("opens a System on its overview, with its health and its parts", async () => {
    await openGame();
    expect(await screen.findByText("Well-formed")).toBeTruthy();
    expect(screen.getByText("10 Components · 6 Languages · 5 Deployments")).toBeTruthy();
  });

  it("opens a Language from the Explorer, and edits it in place", async () => {
    const id = await openGame();
    fireEvent.click(explorerRow("Core"));
    const editor = await editorTitled("Core");
    const entities = () => within(editor.querySelector<HTMLElement>(".grid")!);
    expect(entities().getByText("Monster")).toBeTruthy();

    // Add an Entity by typing its name.
    fireEvent.click(within(editor).getByText("Entity", { selector: ".add-inline, .add-inline *" }));
    const input = editor.querySelector<HTMLInputElement>(".add-input")!;
    fireEvent.change(input, { target: { value: "Item" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(async () => expect(root0(await host.system(id)).languages[0]!.entities.map((e) => e.name)).toContain("Item"));
    await waitFor(() => expect(entities().getByText("Item")).toBeTruthy());

    // Rename it in place.
    fireEvent.click(entities().getByText("Item"));
    const rename = editor.querySelector<HTMLInputElement>(".inline-input")!;
    fireEvent.change(rename, { target: { value: "Loot" } });
    fireEvent.keyDown(rename, { key: "Enter" });
    await waitFor(() => expect(entities().getByText("Loot")).toBeTruthy());

    // Relate two Entities: the new Relationship's ends are named after them.
    fireEvent.click(within(editor).getByText("Relationship", { selector: ".add-inline, .add-inline *" }));
    await waitFor(async () => expect(root0(await host.system(id)).languages[0]!.relationships).toHaveLength(3));
    const ends = root0(await host.system(id)).languages[0]!.relationships[2]!.ends.map((e) => e.name);
    expect(ends).toEqual(["monster", "players"]);
  });

  it("extends: what a Language extends, and what each of its Entities extends, only from those", async () => {
    const id = await openGame("extends.systemathic.json");
    fireEvent.click(explorerRow("Core"));
    const core = await editorTitled("Core");
    // A core Language extends nothing, so its Entities offer nothing to extend.
    expect(core.querySelector(".entity-extends")).toBeNull();
    fireEvent.click(explorerRow("Combat"));
    const combat = await editorTitled("Combat");
    expect(within(combat.querySelector<HTMLElement>(".extends-row")!).getByText("Core")).toBeTruthy();
    const row = [...combat.querySelectorAll<HTMLElement>(".grid tr")].find((r) => r.querySelector(".cell-main")?.textContent?.includes("CombatPlayer"))!;
    const add = row.querySelector<HTMLSelectElement>(".entity-extends .chip-add")!;
    // Only Entities of the Languages Combat extends: Core's and Fighting's.
    expect([...add.options].map((o) => o.textContent).slice(1).sort()).toEqual(["Damage — Fighting", "Monster — Core", "Targetable — Fighting"]);
    expect([...add.options].some((o) => o.textContent?.endsWith("— Combat"))).toBe(false);
    fireEvent.change(add, { target: { value: "fighting.targetable" } });
    await waitFor(async () => {
      const file = await host.system(id);
      const player = root0(file).languages[2]!.entities.find((e) => e.name === "CombatPlayer") as unknown as { extends: string[] };
      expect(player.extends).toEqual(["core.player", "fighting.attacker", "fighting.targetable"]);
    });
  });

  it("reads a Relationship as navigation, and leaves an end unnamed when its name is cleared", async () => {
    const id = await openGame();
    fireEvent.click(explorerRow("Core"));
    await editorTitled("Core");
    // core.pack: leader (at Monster) and followers (at Monster). From a Monster, `.followers` reaches its followers.
    const row = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>(".relationship")].find((r) => r.textContent?.includes("followers"));
      expect(found).toBeTruthy();
      return found!;
    });
    const sides = [...row.querySelectorAll<HTMLElement>(".navigation")].map((n) => n.textContent);
    expect(sides).toEqual([".followers", ".leader"]);
    const ways = [...row.querySelectorAll<HTMLElement>(".way")];
    expect(ways.map((way) => way.querySelector(".way-target")?.textContent)).toEqual(["Monsters", "Monster"]);
    expect(ways.map((way) => way.querySelector<HTMLSelectElement>(".range-select")!.selectedOptions[0]!.textContent)).toEqual(["any number of (0..N)", "at most one (0..1)"]);
    fireEvent.click(within(row).getByText("followers"));
    const input = row.querySelector<HTMLInputElement>(".inline-input")!;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(async () => {
      const pack = root0(await host.system(id)).languages[0]!.relationships.find((r) => r.id === "core.pack")!;
      expect(pack.ends.map((e) => e.name)).toEqual(["leader", null]);
    });
    await waitFor(() => expect(row.querySelector(".navigation.unnamed")?.textContent).toBe(".(unnamed)"));
  });

  it("describes things where they are edited, and reads them all in the Documentation", async () => {
    const id = await openGame();
    fireEvent.click(explorerRow("Core"));
    const editor = await editorTitled("Core");
    const monster = [...editor.querySelectorAll<HTMLElement>(".grid tr")].find((row) => row.querySelector(".cell-main")?.textContent?.includes("Monster"))!;
    fireEvent.click(within(monster).getByText("Add a description"));
    const area = monster.querySelector<HTMLTextAreaElement>(".prose-input")!;
    fireEvent.change(area, { target: { value: "Something to fight.\n\nIt has **hit points**." } });
    fireEvent.keyDown(area, { key: "Enter", ctrlKey: true });
    const described = async () => ((await host.attachment(id, "documentation")) as { descriptions: Record<string, string> } | null)?.descriptions ?? {};
    await waitFor(async () => expect((await described())["core.monster"]).toBe("Something to fight.\n\nIt has **hit points**."));
    expect((await host.history(id)).at(-1)).toMatchObject({ summary: "describe Entity", elements: ["core.monster"] });
    await waitFor(() => expect(monster.querySelector(".description strong")?.textContent).toBe("hit points"));

    fireEvent.click(explorerRow("Documentation"));
    const doc = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(".documentation");
      expect(found?.textContent).toContain("Each Player has any number of Monsters, as prey.");
      return found!;
    });
    expect(within(doc).getByText("Something to fight.")).toBeTruthy();
    fireEvent.click(within(doc).getByText("Describe this System: what it is, and what it is for"));
    const lead = doc.querySelector<HTMLTextAreaElement>(".prose-input")!;
    fireEvent.change(lead, { target: { value: "A small game." } });
    fireEvent.blur(lead);
    await waitFor(async () => expect((await described())["game.system"]).toBe("A small game."));
    const markdown = (await host.documentation(id)).markdown;
    expect(markdown).toContain("# Game\n\nA small game.\n");
    expect(markdown).toContain("- **Monster** — Something to fight.\n\n  It has **hit points**.\n");
  });

  it("on a narrow screen, keeps the Explorer in a drawer that closes once something is opened", async () => {
    await openGame();
    const shell = document.querySelector(".shell")!;
    expect(shell.classList.contains("drawer-open")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Explorer" }));
    expect(shell.classList.contains("drawer-open")).toBe(true);
    fireEvent.click(explorerRow("Combat"));
    await waitFor(() => expect(shell.classList.contains("drawer-open")).toBe(false));
  });

  it("shows a problem where it is, and undoes it", async () => {
    const id = await openGame();
    const session = (await host.startSession(id, "mcp")).session;
    await act(async () => {
      await host.apply(id, session, "RelationshipEditor", "setRange", { end: "core.pack.leader", range: "3..1" });
    });
    await waitFor(() => expect(document.querySelector(".statusbar .status-errors")).not.toBeNull(), { timeout: 5000 });
    expect(await screen.findByText("mcp: setRange 3..1")).toBeTruthy();
    fireEvent.click(document.querySelector(".statusbar .status-errors")!);
    const problem = await screen.findByText("min <= max, where max is present");
    fireEvent.click(problem);
    await editorTitled("Core");
    await act(async () => {
      await host.undo(id, session);
    });
    await waitFor(() => expect(document.querySelector(".statusbar .status-errors")).toBeNull());
  });

  it("fixes a problem in one click, where its Suggestion carries the fix", async () => {
    const id = await openGame();
    const session = (await host.startSession(id, "mcp")).session;
    await act(async () => {
      await host.apply(id, session, "LanguageEditor", "extend", { language: "core", extended: "combat" });
    });
    await waitFor(() => expect(document.querySelector(".statusbar .status-errors")).not.toBeNull(), { timeout: 5000 });
    fireEvent.click(document.querySelector(".statusbar .status-errors")!);
    // Break the cycle where it was made: Core stops extending Combat, as it did before.
    const problems = await screen.findAllByText("No Language extends itself, eventually");
    const core = problems.map((p) => p.closest("li")!).find((li) => li.querySelector(".problem-where")?.textContent === "Core")!;
    fireEvent.click(within(core).getByRole("button", { name: "Fix" }));
    await waitFor(() => expect(screen.queryByText("No Language extends itself, eventually")).toBeNull(), { timeout: 5000 });
    await waitFor(() => expect(document.querySelector(".statusbar .status-errors")).toBeNull(), { timeout: 5000 });
  });

  it("edits a Component in the order of design: what it uses, its Interactions, its Transformations", async () => {
    const id = await openGame("component.systemathic.json");
    fireEvent.click(explorerRow("Server"));
    const editor = await editorTitled("Server");
    const kinds = [...editor.querySelectorAll(".editor-section h3")].map((h) => h.textContent?.replace(/\d+$/, ""));
    expect(kinds).toEqual(["Languages", "Uses", "Implements", "Exports", "Imports", "Interactions", "Components", "Transformations", "Mediums", "Deployments"]);
    expect(editor.querySelector(".breadcrumb")?.textContent).toContain("Game");
    const uses = editor.querySelectorAll<HTMLSelectElement>(".chip-add")[0]!;
    fireEvent.change(uses, { target: { value: "core" } });
    await waitFor(async () => expect(root0(await host.system(id)).components.find((c) => c.id === "game.server")!.uses).toEqual(["combat", "core"]));
    fireEvent.click(within(editor).getByText("Interaction", { selector: ".add-inline, .add-inline *" }));
    const input = editor.querySelector<HTMLInputElement>(".add-input")!;
    fireEvent.change(input, { target: { value: "heal" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(async () => expect(root0(await host.system(id)).components.find((c) => c.id === "game.server")!.interactions.map((i) => i.name)).toEqual(["attack", "heal"]));
    fireEvent.click(screen.getByText("Transformation", { selector: ".add-inline, .add-inline *" }));
    const [from, to] = document.querySelectorAll<HTMLSelectElement>(".new-transformation .picker");
    fireEvent.change(from!, { target: { value: "core.monster" } });
    fireEvent.change(to!, { target: { value: "combat.combat-monster" } });
    fireEvent.click(screen.getByText("Create"));
    await editorTitled("Core as Combat");
  });

  it("shows a realization's signature, the way back, and what it realizes", async () => {
    await openGame();
    fireEvent.click(explorerRow("CombatOverNetwork"));
    fireEvent.click(await screen.findByText("Combat down to Network", { selector: ".cell-main" }));
    const editor = await editorTitled("Combat down to Network");
    expect(editor.querySelector(".editor-header")?.textContent).toContain("Combat → Network");
    expect(within(editor).getByText("Network up to Combat", { selector: ".card-title" })).toBeTruthy();
    expect(editor.querySelectorAll(".parameter")).toHaveLength(1);
  });

  it("exports a Component's API, and a Deployment reaches inside another, wherever it is, through what that one exports", async () => {
    const id = await openGame("exports.systemathic.json");
    const session = (await host.startSession(id, "test")).session;
    await act(async () => {
      const inner = (await host.apply(id, session, "ComponentEditor", "addComponent", { parent: "game.server", name: "Inner" })).elements[0]!;
      await host.apply(id, session, "ComponentEditor", "use", { component: inner, language: "combat" });
      await host.apply(id, session, "InteractionEditor", "addInteraction", { component: inner, language: "combat", name: "parry", output: "fighting.damage" });
    });
    fireEvent.click(explorerRow("Client"));
    fireEvent.click(within(await editorTitled("Client")).getByText("Desktop", { selector: ".card-title" }));
    const editor = await editorTitled("Desktop");
    // A Deployment's needs: what calls is a Deployment, and it imports what it needs.
    const reach = [...editor.querySelectorAll<HTMLSelectElement>(".picker")].find((p) => p.textContent?.includes("Reach…"))!;
    fireEvent.change(reach, { target: { value: "game.server.inner.parry" } });
    await waitFor(async () => {
      const client = (await host.system(id)).design.root.components.find((c: { id: string }) => c.id === "game.client") as { deployments: { id: string; imports: { from: string; exports: string[] }[] }[] };
      const desktop = client.deployments.find((d) => d.id === "game.client.desktop")!;
      expect(desktop.imports.find((i) => i.from === "game.server.inner")?.exports).toEqual(["game.server.inner:game.server.inner.parry"]);
    });
    await waitFor(() => expect(within(editor).getAllByText("parry").length).toBeGreaterThan(0));
  });

  it("connects through interfaces, and asks before a call out through the box brings the import it needs", async () => {
    const id = await openGame("connect.systemathic.json");
    const session = (await host.startSession(id, "test")).session;
    await act(async () => {
      await host.apply(id, session, "DeploymentEditor", "remove", { item: "game.local.client-attacks" });
      await host.apply(id, session, "DeploymentEditor", "remove", { item: "game.client.desktop.input-attacks" });
      await host.apply(id, session, "ComponentEditor", "unimport", { component: "game.client.desktop", item: "game.server:game.server.attack" });
    });
    // Between two Instances, a Connection is structure: nothing to import.
    fireEvent.click(explorerRow("Local"));
    const local = await editorTitled("Local");
    const client = [...local.querySelectorAll<HTMLElement>(".instance-row")].find((r) => r.textContent?.includes("client"))!;
    menuItem(client, "Connect to server");
    const panel = await waitFor(() => {
      const found = local.querySelector<HTMLElement>(".connect-panel");
      expect(found).toBeTruthy();
      return found!;
    });
    expect(panel.textContent).not.toContain("does not import");
    fireEvent.click(within(panel).getByText("Connect"));
    await waitFor(async () => {
      const game = root0(await host.system(id)) as unknown as { deployments: { id: string; connections: unknown[] }[] };
      expect(game.deployments.find((d) => d.id === "game.local")!.connections).toHaveLength(1);
    });
    // Out through the box: the Desktop must import attack, as its need — asked first.
    fireEvent.click(explorerRow("Client"));
    fireEvent.click(within(await editorTitled("Client")).getByText("Desktop", { selector: ".card-title" }));
    const desktop = await editorTitled("Desktop");
    const input = [...desktop.querySelectorAll<HTMLElement>(".instance-row")].find((r) => r.textContent?.includes("input"))!;
    menuItem(input, "Connect to Client itself");
    const offered = await waitFor(() => {
      const found = desktop.querySelector<HTMLElement>(".connect-panel");
      expect(found).toBeTruthy();
      return found!;
    });
    // Carry attack, and only attack.
    for (const box of offered.querySelectorAll<HTMLInputElement>(".what-choices input[type=checkbox]")) {
      const wanted = box.parentElement!.textContent!.startsWith("attack()");
      if (box.checked !== wanted) fireEvent.click(box);
    }
    const out = await waitFor(() => {
      const found = desktop.querySelector<HTMLElement>(".connect-panel");
      expect(found?.textContent).toContain("Desktop does not import attack");
      return found!;
    });
    fireEvent.click(within(out).getByText("Connect"));
    await waitFor(async () => {
      const game = root0(await host.system(id)) as unknown as { components: { id: string; deployments: { id: string; imports: { from: string; exports: string[] }[] }[] }[] };
      const clientBox = game.components.find((c) => c.id === "game.client")!;
      expect(clientBox.deployments.find((d) => d.id === "game.client.desktop")!.imports.find((i) => i.from === "game.server")!.exports).toEqual(["game.server:game.server.attack"]);
    });
  });

  it("shows a Connection's stack: a broken level in red, and a realization made in one step", async () => {
    const id = await openGame("stack.systemathic.json");
    const session = (await host.startSession(id, "test")).session;
    await act(async () => {
      await host.apply(id, session, "MediationEditor", "realize", { mediation: "game.online.client-2-attacks#m0" });
      await host.apply(id, session, "MediumEditor", "remove", { medium: "pkg.link.medium" });
    });
    fireEvent.click(explorerRow("Online"));
    const editor = await editorTitled("Online");
    await waitFor(() => expect(editor.querySelectorAll(".mediation-level.broken")).toHaveLength(2));
    const card = [...editor.querySelectorAll<HTMLElement>(".connection-card")].find((c) => c.textContent?.includes("client-2"))!;
    fireEvent.click(within(card).getByText("Create realization"));
    await waitFor(async () => {
      const file = await host.system(id);
      const online = (root0(file) as unknown as { deployments: { id: string; connections: { id: string; mediations: { down: string | null }[] }[] }[] }).deployments.find((d) => d.id === "game.online")!;
      expect(online.connections.find((c) => c.id === "game.online.client-2-attacks")!.mediations[0]!.down).toBeTruthy();
    });
  });

  it("puts the whole System together in a Configuration, one Instance at a time", async () => {
    const id = await openGame("configuration.systemathic.json");
    fireEvent.click(explorerRow("Release"));
    const editor = await editorTitled("Release");
    const rows = [...editor.querySelectorAll<HTMLElement>(".choice-row")].map((r) => r.querySelector("strong")?.textContent);
    // Each Instance's choice, and beneath it, the choices for the Instances of the Deployment chosen.
    expect(rows).toEqual(["Game", "server", "physics", "client-1", "physics", "input", "client-2", "physics", "input"]);
    const client2 = [...editor.querySelectorAll<HTMLElement>(".choice-row")].find((r) => r.querySelector("strong")?.textContent === "client-2")!;
    menuItem(client2, "Remove this occupant's Choice");
    const stored = async () => (await host.system(id)).attachments.find((a: { owner: string }) => a.owner === "configurations")!.data as { configurations: { root: { choices: unknown[] } }[] };
    await waitFor(async () => expect((await stored()).configurations[0]!.root.choices).toHaveLength(2));
  });

  it("edits the verification script, with its rules beside it", async () => {
    await openGame();
    fireEvent.click(explorerRow("Verification script"));
    await waitFor(() => expect(document.querySelector(".cm-editor")).not.toBeNull(), { timeout: 10_000 });
    expect(document.querySelector(".cm-content")?.textContent).toContain("every_component_uses_a_language");
    await screen.findByText("every_component_uses_a_language", { selector: ".rule-list code" }, { timeout: 10_000 });
    const opacity = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLDetailsElement>(".profile-rules details")].find((d) => d.querySelector("summary")?.textContent?.includes("opacity"));
      expect(found).toBeTruthy();
      return found!;
    }, { timeout: 10_000 });
    expect(opacity.open).toBe(false);
    expect(opacity.querySelector(".rule-about")?.textContent).toMatch(/^Every mediated Connection is opaque/);
    expect(opacity.querySelector(".prose")?.textContent).toContain("This is what makes a how swappable");
    fireEvent.click(screen.getByText("Save", { selector: ".editor-actions button, .editor-actions button *" }));
    await waitFor(async () => expect(await host.attachment((await host.contexts())[0]!.id, "verifier")).toEqual({ script: "game.rules.py", profile: "profile" }));
  }, 20_000);

  it("switches profile, and resizes the verification pane", async () => {
    const { id } = await host.open("game.systemathic.json");
    const source = [
      "from systemathic.core import *",
      "from systemathic.std import *",
      "",
      "profile = Profile(*standard_rules)",
      'strict = Profile(*standard_rules, mediation_primitives("In-process"))',
      "",
    ].join("\n");
    await host.saveScript(id, "game.rules.py", source);
    await openGame();
    fireEvent.click(explorerRow("Verification script"));
    const picker = await waitFor(() => {
      const select = document.querySelector<HTMLSelectElement>(".profile-picker select");
      expect([...(select?.options ?? [])].map((o) => o.value).sort()).toEqual(["profile", "standard", "strict"]);
      return select!;
    }, { timeout: 10_000 });
    fireEvent.change(picker, { target: { value: "strict" } });
    await waitFor(async () => expect(await host.attachment(id, "verifier")).toEqual({ script: "game.rules.py", profile: "strict" }));
    expect((await host.verify(id)).errors).toBeGreaterThan(0);

    const pane = document.querySelector<HTMLElement>(".script-side")!;
    expect(pane.style.width).toBe("320px");
    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize the verification pane" }), { key: "ArrowLeft", shiftKey: true });
    await waitFor(() => expect(pane.style.width).toBe("368px"));
    await waitFor(async () => expect(((await host.attachment(id, "ui")) as { sizes: Record<string, number> }).sizes["script-side"]).toBe(368), { timeout: 3000 });
  }, 20_000);

  it("says so when the host is older than the page, rather than breaking", async () => {
    const current = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.startsWith("/api/files")) return new Response(JSON.stringify({ error: "no route" }), { status: 404 });
      const response = await current(input, init);
      if (path === "/api/contexts") {
        const contexts = (await response.json()) as Record<string, unknown>[];
        return new Response(JSON.stringify(contexts.map(({ clients: _c, dirty: _d, ...rest }) => rest)));
      }
      return response;
    }) as typeof fetch;
    try {
      window.history.replaceState(null, "", "#");
      render(<App />);
      await screen.findByText(/older than the page/);
      expect(await screen.findByText("Open now")).toBeTruthy();
    } finally {
      globalThis.fetch = current;
    }
  });

  it("goes anywhere from the command palette", async () => {
    await openGame();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByPlaceholderText("Go to anything, or type a command…");
    fireEvent.change(input, { target: { value: "online" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await editorTitled("Online");
    expect(screen.getAllByText("Connections").length).toBeGreaterThan(0);
  });

  it("verifies, and shows the result", async () => {
    await openGame();
    fireEvent.click(document.querySelector(".system-row")!);
    fireEvent.click(await screen.findByText("Verify", { selector: ".health-card button" }));
    await screen.findByText(/^\d+ rule errors?, \d+ warnings?$/, {}, { timeout: 15000 });
  }, 20_000);
});
