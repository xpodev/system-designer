import { readFileSync } from "node:fs";
import { Target, undo } from "@systemathic/editing";
import { ArgumentError, ComponentEditor, DeploymentEditor } from "@systemathic/editors";
import { open, save } from "@systemathic/tool";
import { readSystem, writeSystem } from "@systemathic/tool-json";
import { describe as group, expect, it } from "vitest";
import { addConfiguration, changeChoice, choose, configuration, configurationEditor, configurations, problems, setRules, unchoose } from "../src/index.js";

const game = JSON.parse(readFileSync(new URL("../../../examples/game.systemathic.json", import.meta.url), "utf8"));
const load = () => {
  const target = new Target(open(readSystem(game).system));
  return { target, s: target.startSession("test") };
};

group("configurations", () => {
  it("are read from the System's attachment, and fit the design", () => {
    const { target } = load();
    const [release] = configurations(target.context);
    expect(release).toMatchObject({ id: "game.release", name: "Release", rules: [], root: { instance: null, component: "game", deployment: "game.online" } });
    expect(release!.root.choices.map((c) => [c.instance, c.component, c.deployment])).toEqual([
      ["game.online.server", "game.server", "game.server.single"],
      ["game.online.client-1", "game.client", "game.client.desktop"],
      ["game.online.client-2", "game.client", "game.client.desktop"],
    ]);
    expect(problems(target.context)).toEqual([]);
  });

  it("choose per occupant, by the Instance's own Component or one implementing it, and say where a choice does not fit", () => {
    const { target, s } = load();
    const added = addConfiguration(s, "Test", "game.online");
    const [, test] = configurations(target.context);
    expect(test!.root.component).toBe("game");
    choose(s, test!.root.id, "game.online.server", "game.server", "game.server.single");
    expect(problems(target.context)).toEqual([]);
    const backup = ComponentEditor.addComponent(s, "game", "Backup").elements[0]!;
    choose(s, test!.root.id, "game.online.server", backup);
    expect(problems(target.context).map((p) => p.message)).toEqual([
      "server has 2 occupants chosen, but at most 1",
      "Backup neither is Server nor implements it",
    ]);
    ComponentEditor.implement(s, backup, "game.server");
    DeploymentEditor.setRange(s, "game.online.server", "1..N");
    expect(problems(target.context)).toEqual([]);
    expect(added.kind).toBe("addition");
  });

  it("drop what was chosen below when a Deployment changes, and are undone on the one History", () => {
    const { target, s } = load();
    const root = configuration(target.context, "game.release")!.root;
    const client = root.choices[1]!;
    const mobile = DeploymentEditor.addDeployment(s, "game.client", "Mobile").elements[0]!;
    choose(s, client.id, "game.client.desktop.input", "game.client.input");
    expect(configuration(target.context, "game.release")!.root.choices[1]!.choices).toHaveLength(1);
    changeChoice(s, client.id, "game.client", mobile);
    expect(configuration(target.context, "game.release")!.root.choices[1]).toMatchObject({ deployment: mobile, choices: [] });
    undo(s);
    expect(configuration(target.context, "game.release")!.root.choices[1]!.choices).toHaveLength(1);
    unchoose(s, client.id);
    expect(configuration(target.context, "game.release")!.root.choices).toHaveLength(2);
    expect(() => unchoose(s, root.id)).toThrow(ArgumentError);
  });

  it("name their profile, and leave the design untouched", () => {
    const { target, s } = load();
    const before = writeSystem(save(target.context)).design;
    setRules(s, "game.release", ["opacity", "imports_acyclic"]);
    expect(configuration(target.context, "game.release")!.rules).toEqual(["opacity", "imports_acyclic"]);
    expect(writeSystem(save(target.context)).design).toEqual(before);
  });

  it("are edited through operations described as data", () => {
    const { target, s } = load();
    const run = (name: string, args: Record<string, unknown>) => configurationEditor.find((op) => op.name === name)!.run(s, args);
    run("setRules", { configuration: "game.release", rules: "opacity, deployments_complete" });
    expect(configuration(target.context, "game.release")!.rules).toEqual(["opacity", "deployments_complete"]);
    run("rename", { configuration: "game.release", name: "Ship" });
    expect(configuration(target.context, "game.release")!.name).toBe("Ship");
    run("remove", { configuration: "game.release" });
    expect(configurations(target.context)).toEqual([]);
    expect(() => run("rename", { configuration: "nothing", name: "X" })).toThrow("there is no Configuration nothing");
  });
});
