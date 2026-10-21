import { readFileSync } from "node:fs";
import { Target, undo } from "@systemathic/editing";
import { ArgumentError, ComponentEditor, DeploymentEditor } from "@systemathic/editors";
import { open, save, type SystemContext } from "@systemathic/tool";
import { readSystem, writeSystem } from "@systemathic/tool-json";
import { describe as group, expect, it } from "vitest";
import {
  addConfiguration,
  changeChoice,
  choose,
  configuration,
  configurationEditor,
  configurations,
  current,
  occupants,
  problems,
  configurationsProvider,
  setCurrent,
  setRules,
  unchoose,
} from "../src/index.js";

/** The System as it is stored, once Configurations has saved into a copy of it. */
async function saved(context: SystemContext) {
  const copy = open(save(context));
  await configurationsProvider.save(copy, undefined);
  return save(copy);
}

const game = JSON.parse(readFileSync(new URL("../../../examples/game.systemathic.json", import.meta.url), "utf8"));
const load = () => {
  const target = new Target(open(readSystem(game).system));
  return { target, s: target.startSession("test") };
};

group("configurations", () => {
  it("are read from the System's attachment, and fit the design", () => {
    const { target } = load();
    const [release] = configurations(target.context);
    expect(release).toMatchObject({ id: "game.release", name: "Release", rules: [], root: { instance: null, deployment: "game.online" } });
    expect(release!.root.choices.map((c) => [c.instance, c.deployment])).toEqual([
      ["game.online.server", "game.server.single"],
      ["game.online.client-1", "game.client.desktop"],
      ["game.online.client-2", "game.client.desktop"],
    ]);
    expect(problems(target.context)).toEqual([]);
    expect(current(target.context)?.id).toBe("game.release");
  });

  it("know every real Instance, by its path, with what it runs", () => {
    const { target } = load();
    const real = occupants(target.graph, current(target.context)!);
    expect(real.map((o) => [o.path.join("/"), o.deployment])).toContainEqual(["game.online.client-1/game.client.desktop.input", null]);
    expect(real[0]).toMatchObject({ instance: null, deployment: "game.online", path: [] });
  });

  it("choose a Deployment of the occupant's box, per occupant, and say where a choice does not fit (C1, C2)", () => {
    const { target, s } = load();
    const added = addConfiguration(s, "Test", "game.online");
    const [, test] = configurations(target.context);
    expect(test!.root.deployment).toBe("game.online");
    choose(s, test!.root.id, "game.online.server", "game.server.single");
    expect(problems(target.context)).toEqual([]);
    choose(s, test!.root.id, "game.online.server", "game.client.desktop");
    expect(problems(target.context).map((p) => [p.check, p.message])).toEqual([
      ["C2", "Test: server has 2 occupants chosen, but at most 1"],
      ["C1", "Test: Desktop is not a Deployment of Server"],
    ]);
    const backup = DeploymentEditor.addDeployment(s, "game.server", "Backup").elements[0]!;
    DeploymentEditor.setRange(s, "game.online.server", "1..N");
    const [, again] = configurations(target.context);
    changeChoice(s, again!.root.choices[1]!.id, backup);
    expect(problems(target.context)).toEqual([]);
    DeploymentEditor.setRuns(s, "game.online.server", "game.server.single");
    expect(problems(target.context).map((p) => p.message)).toEqual(["Test: server runs Single, fixed, not Backup"]);
    expect(added.kind).toBe("addition");
  });

  it("find a need nothing present meets, and an identity that does not exist (C3, C4)", () => {
    const { target, s } = load();
    // The Desktop now needs the Server's Single Deployment, which the Server exports.
    ComponentEditor.exportItem(s, "game.server", "game.server.single");
    ComponentEditor.importItem(s, "game.client.desktop", "game.server:game.server.single");
    expect(problems(target.context)).toEqual([]);
    unchoose(s, configuration(target.context, "game.release")!.root.choices[0]!.id);
    expect(problems(target.context).map((p) => [p.check, p.message])).toEqual([
      ["C4", "Release: Desktop needs Single, which no occupant runs"],
      ["C4", "Release: Desktop needs Single, which no occupant runs"],
    ]);
    undo(s);
    // An identity into Local, which Release does not choose: it does not exist here.
    DeploymentEditor.expose(s, "game.local", "game.local.server");
    DeploymentEditor.importIdentity(s, "game.client.desktop", ["game.local.server"]);
    expect(problems(target.context).map((p) => p.check)).toEqual(["C3", "C3"]);
  });

  it("drop what was chosen below when a Deployment changes, and are undone on the one History", () => {
    const { target, s } = load();
    const root = configuration(target.context, "game.release")!.root;
    const client = root.choices[1]!;
    const mobile = DeploymentEditor.addDeployment(s, "game.client", "Mobile").elements[0]!;
    choose(s, client.id, "game.client.desktop.input");
    expect(configuration(target.context, "game.release")!.root.choices[1]!.choices).toHaveLength(1);
    changeChoice(s, client.id, mobile);
    expect(configuration(target.context, "game.release")!.root.choices[1]).toMatchObject({ deployment: mobile, choices: [] });
    undo(s);
    expect(configuration(target.context, "game.release")!.root.choices[1]!.choices).toHaveLength(1);
    unchoose(s, client.id);
    expect(configuration(target.context, "game.release")!.root.choices).toHaveLength(2);
    expect(() => unchoose(s, root.id)).toThrow(ArgumentError);
  });

  it("go with what they choose, until the System is saved, so undo brings them back", async () => {
    const { target, s } = load();
    const choices = () => configuration(target.context, "game.release")!.root.choices.map((c) => [c.instance, c.deployment]);
    const before = choices();
    DeploymentEditor.remove(s, "game.online.client-2");
    DeploymentEditor.remove(s, "game.server.single");
    expect(choices()).toEqual([
      ["game.online.server", null],
      ["game.online.client-1", "game.client.desktop"],
    ]);
    expect(problems(target.context).filter((p) => p.check === "C1")).toEqual([]);
    const file = writeSystem(await saved(target.context));
    expect(file.attachments).toContainEqual({
      owner: "configurations",
      data: expect.objectContaining({ configurations: [expect.objectContaining({ id: "game.release", root: expect.objectContaining({ choices: [expect.anything(), expect.anything()] }) })] }),
    });
    undo(s);
    undo(s);
    expect(choices()).toEqual(before);
  });

  it("name their profile, one is current, and leave the design untouched", () => {
    const { target, s } = load();
    const before = writeSystem(save(target.context)).design;
    setRules(s, "game.release", ["opacity", "imports_acyclic"]);
    expect(configuration(target.context, "game.release")!.rules).toEqual(["opacity", "imports_acyclic"]);
    const other = addConfiguration(s, "Other", "game.local").elements[0]!;
    expect(current(target.context)?.id).toBe("game.release");
    setCurrent(s, other);
    expect(current(target.context)?.id).toBe(other);
    undo(s);
    expect(current(target.context)?.id).toBe("game.release");
    expect(writeSystem(save(target.context)).design).toEqual(before);
  });

  it("are edited through operations described as data", () => {
    const { target, s } = load();
    const run = (name: string, args: Record<string, unknown>) => configurationEditor.find((op) => op.name === name)!.run(s, args);
    run("setRules", { configuration: "game.release", rules: "opacity, construction_acyclic" });
    expect(configuration(target.context, "game.release")!.rules).toEqual(["opacity", "construction_acyclic"]);
    run("rename", { configuration: "game.release", name: "Ship" });
    expect(configuration(target.context, "game.release")!.name).toBe("Ship");
    run("remove", { configuration: "game.release" });
    expect(configurations(target.context)).toEqual([]);
    expect(() => run("rename", { configuration: "nothing", name: "X" })).toThrow("there is no Configuration nothing");
  });
});
