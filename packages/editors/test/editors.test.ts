import { imported, importedComponents, mediationStack, nameOf, parameters } from "@systemathic/core";
import { diagnose } from "@systemathic/diagnoser";
import { Target, undo } from "@systemathic/editing";
import { newSystem } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import {
  ArgumentError,
  ComponentEditor,
  DeploymentEditor,
  EntityEditor,
  FormulaEditor,
  FunctionEditor,
  InteractionEditor,
  LanguageEditor,
  MediationEditor,
  MediumEditor,
  RelationshipEditor,
  editors,
  findOperation,
} from "../src/index.js";

const created = (edit: { elements: readonly string[] }) => edit.elements[0]!;

/** The game of docs/foundation.md, small, built through the editors. */
function game() {
  const target = new Target(newSystem("Game"));
  const s = target.startSession("test");
  const root = target.context.root!;
  const core = created(ComponentEditor.addLanguage(s, root, "Core"));
  const monster = created(LanguageEditor.addEntity(s, core, "Monster"));
  const pack = created(
    LanguageEditor.addRelationship(s, core, { entity: monster, name: "leader", range: "0..1" }, { entity: monster, name: "followers", range: "0..N" }),
  );
  const acyclic = created(LanguageEditor.addFormula(s, core, "all m in Monster. not m in m.^leader"));
  const fighting = created(ComponentEditor.addLanguage(s, root, "Fighting"));
  const attacker = created(LanguageEditor.addEntity(s, fighting, "Attacker"));
  const damage = created(LanguageEditor.addEntity(s, fighting, "Damage"));
  const combat = created(ComponentEditor.addLanguage(s, root, "Combat"));
  LanguageEditor.extend(s, combat, core);
  LanguageEditor.extend(s, combat, fighting);
  const fighter = created(LanguageEditor.addEntity(s, combat, "CombatMonster"));
  EntityEditor.extend(s, fighter, monster);
  EntityEditor.extend(s, fighter, attacker);

  const network = created(ComponentEditor.addLanguage(s, root, "Network"));
  const message = created(LanguageEditor.addEntity(s, network, "Message"));
  ComponentEditor.use(s, root, network);
  const send = created(InteractionEditor.addInteraction(s, root, network, "send", message));
  FunctionEditor.addParameter(s, send, "message", message);
  const medium = created(MediumEditor.addMedium(s, root, "Network", network, send));

  const server = created(ComponentEditor.addComponent(s, root, "Server"));
  ComponentEditor.use(s, server, combat);
  const attack = created(InteractionEditor.addInteraction(s, server, combat, "attack", damage));
  const by = created(FunctionEditor.addParameter(s, attack, "by", attacker));
  const client = created(ComponentEditor.addComponent(s, root, "Client"));
  ComponentEditor.use(s, client, combat);

  const online = created(DeploymentEditor.addDeployment(s, root, "Online"));
  const serverInstance = created(DeploymentEditor.addInstance(s, online, server, "server"));
  const clientInstance = created(DeploymentEditor.addInstance(s, online, client, "client"));
  const wire = created(DeploymentEditor.connect(s, online, clientInstance, serverInstance, [attack], { addImports: true }));
  const mediation = created(MediationEditor.addMediation(s, wire, medium));
  MediationEditor.createRealization(s, mediation);
  return { target, s, root, core, monster, pack, acyclic, combat, fighter, attacker, damage, network, message, send, medium, server, attack, by, client, online, serverInstance, clientInstance, wire, mediation };
}

const wrong = (target: Target) => diagnose(target.context).map((d) => d.check);

describe("concept editors", () => {
  it("build a well-formed System, all on one History", () => {
    const { target, attack, by } = game();
    expect(diagnose(target.context)).toEqual([]);
    expect(parameters(target.graph, attack)).toEqual([by]);
    expect(target.history.edits.every((edit) => edit.elements.length > 0)).toBe(true);
  });

  it("connect, and bring the import and the use the Connection needs only when asked", () => {
    const { target, s, online, clientInstance, serverInstance, attack, client, combat, server } = game();
    ComponentEditor.unuse(s, client, combat);
    ComponentEditor.unimportItem(s, client, server);
    expect(DeploymentEditor.needs(target.graph, clientInstance, [attack])).toEqual({ imports: [attack], uses: [combat] });
    DeploymentEditor.connect(s, online, clientInstance, serverInstance, [attack]);
    expect(wrong(target)).toContain("W10");
    undo(s);
    DeploymentEditor.connect(s, online, clientInstance, serverInstance, [attack], { addImports: true, addUses: true });
    expect(wrong(target)).toEqual([]);
  });

  it("realize a Mediation in a Component of its own, imported by both ends", () => {
    const { target, mediation, client, server, root } = game();
    const [down] = target.graph.navigate(mediation, "down");
    const [up] = target.graph.navigate(mediation, "up");
    const [holder] = target.graph.navigate(down!, "component");
    expect(nameOf(target.graph, holder!)).toBe("CombatOverNetwork");
    // The way down takes what attack takes and gives what send takes; the way up, the reverse.
    const typeOf = (f: string) => parameters(target.graph, f).map((p) => nameOf(target.graph, target.graph.navigate(p, "type")[0]!));
    const outputOf = (f: string) => nameOf(target.graph, target.graph.navigate(f, "output")[0]!);
    expect([typeOf(down!), outputOf(down!)]).toEqual([["Attacker"], "Message"]);
    expect([typeOf(up!), outputOf(up!)]).toEqual([["Message"], "Damage"]);
    expect(target.graph.navigate(holder!, "parent")).toEqual([root]);
    for (const end of [client, server]) expect(imported(target.graph, end, "Transformation")).toEqual(target.graph.navigate(mediation, "down").concat(target.graph.navigate(mediation, "up")));
  });

  it("export, re-export and reach: a Component reaches inside another only through what it exports", () => {
    const { target, s, server, client, combat, damage } = game();
    const inner = created(ComponentEditor.addComponent(s, server, "Inner"));
    ComponentEditor.use(s, inner, combat);
    const parry = created(InteractionEditor.addInteraction(s, inner, combat, "parry", damage));
    ComponentEditor.reachItem(s, client, parry);
    expect(imported(target.graph, client, "Interaction")).toContain(parry);
    const [own] = target.graph.navigate(inner, "exports");
    const reexport = target.graph.navigate(server, "exports").find((e) => target.graph.navigate(e, "export").includes(own!));
    expect(reexport).toBeDefined();
    expect(wrong(target)).toEqual([]);
    // Taking inner's own Export, from a Component the Client cannot import from, is ill-formed.
    ComponentEditor.importItem(s, client, own!);
    expect(wrong(target)).toContain("W9");
    undo(s);
    // Removing inner's Export takes the re-export with it; the Client's Import keeps the rest.
    ComponentEditor.unexport(s, own!);
    expect(target.graph.has(reexport!)).toBe(false);
    expect(imported(target.graph, client, "Interaction")).not.toContain(parry);
    expect(imported(target.graph, client, "Interaction")).not.toEqual([]);
  });

  it("leave a Mediation broken in its stack when its Medium goes, and undo it exactly", () => {
    const { target, s, medium, wire, mediation } = game();
    MediumEditor.remove(s, medium);
    expect(mediationStack(target.graph, wire)).toEqual([mediation]);
    expect(diagnose(target.context).filter((d) => d.check === "range").map((d) => d.subjects)).toContainEqual([mediation]);
    undo(s);
    expect(diagnose(target.context)).toEqual([]);
  });

  it("read Formulas over what their Language extends", () => {
    const { target, s, combat } = game();
    created(LanguageEditor.addFormula(s, combat, "all m in CombatMonster. not m in m.^leader"));
    expect(wrong(target)).toEqual([]);
  });

  it("leave an end unnamed: the Relationship is navigable one way only", () => {
    const { target, s, core, monster, pack, acyclic } = game();
    const player = created(LanguageEditor.addEntity(s, core, "Player"));
    const owns = created(
      LanguageEditor.addRelationship(s, core, { entity: player, name: "owner", range: "1..1" }, { entity: monster, name: "pets", range: "0..N" }),
    );
    const [, pets] = target.graph.navigate(owns, "ends");
    RelationshipEditor.renameEnd(s, pets!, undefined);
    expect(target.history.edits.at(-1)!.summary).toBe("unnameEnd");
    expect(wrong(target)).toEqual([]);
    FormulaEditor.setText(s, acyclic, "all m in Monster. some m.owner");
    expect(wrong(target)).toEqual([]);
    FormulaEditor.setText(s, acyclic, "all p in Player. some p.pets");
    expect(diagnose(target.context).map((d) => d.message)).toEqual(["the formula does not fit its Language: Player has no end 'pets'"]);
    const [, followers] = target.graph.navigate(pack, "ends");
    RelationshipEditor.renameEnd(s, followers!, undefined);
    FormulaEditor.setText(s, acyclic, "all m in Monster. not m in m.^leader");
    expect(wrong(target)).toEqual([]);
  });

  it("read Formulas afresh after a rename", () => {
    const { target, s, pack, acyclic } = game();
    const leader = target.graph.navigate(pack, "ends")[0]!;
    RelationshipEditor.renameEnd(s, leader, "boss");
    expect(wrong(target)).toEqual(["formula"]);
    FormulaEditor.setText(s, acyclic, "all m in Monster. not m in m.^boss");
    expect(wrong(target)).toEqual([]);
  });

  it("let an edit leave the System ill-formed, and show it", () => {
    const { target, s, pack } = game();
    const [leader] = target.graph.navigate(pack, "ends");
    RelationshipEditor.setRange(s, leader!, "2..1");
    expect(wrong(target)).toContain("W2");
    undo(s);
    expect(wrong(target)).toEqual([]);
  });

  it("remove with the foundation's cascade, and undo it exactly", () => {
    const { target, s, combat, attack, wire } = game();
    LanguageEditor.remove(s, combat);
    for (const id of [attack, wire]) expect(target.graph.has(id)).toBe(false);
    undo(s);
    expect(diagnose(target.context)).toEqual([]);
    expect(target.graph.has(wire)).toBe(true);
  });

  it("order Parameters", () => {
    const { target, s, attack, by, attacker } = game();
    const second = created(FunctionEditor.addParameter(s, attack, "with", attacker));
    const first = created(FunctionEditor.addParameter(s, attack, "first", attacker, 0));
    expect(parameters(target.graph, attack)).toEqual([first, by, second]);
    FunctionEditor.moveParameter(s, first, 2);
    expect(parameters(target.graph, attack)).toEqual([by, second, first]);
    FunctionEditor.removeParameter(s, by);
    expect(parameters(target.graph, attack)).toEqual([second, first]);
  });

  it("give a Function no output, and add a Transformation from an input to an output", () => {
    const { target, s, root, attack, monster, message } = game();
    FunctionEditor.setOutput(s, attack, undefined);
    expect(target.graph.navigate(attack, "output")).toEqual([]);
    expect(wrong(target)).toEqual([]);
    const down = created(ComponentEditor.addTransformation(s, root, "Monsters as messages", monster, message));
    expect(parameters(target.graph, down).map((p) => nameOf(target.graph, p))).toEqual(["monster"]);
    expect(wrong(target)).toEqual(["W6"]);
    ComponentEditor.use(s, root, target.graph.navigate(monster, "language")[0]!);
    expect(wrong(target)).toEqual([]);
  });

  it("implement a Component, and place Instances with a range", () => {
    const { target, s, root, server, online, serverInstance } = game();
    const backup = created(ComponentEditor.addComponent(s, root, "Backup"));
    ComponentEditor.implement(s, backup, server);
    expect(target.graph.navigate(backup, "implements")).toEqual([server]);
    expect(importedComponents(target.graph, backup)).toEqual([server]);
    expect(wrong(target)).toEqual(["W14"]);
    ComponentEditor.use(s, backup, target.graph.navigate(server, "uses")[0]!);
    expect(wrong(target)).toEqual([]);
    DeploymentEditor.setRange(s, serverInstance, "1..N");
    expect(target.graph.navigate(serverInstance, "max")).toEqual([]);
    DeploymentEditor.setRange(s, serverInstance, "2..1");
    expect(wrong(target)).toEqual(["W2"]);
    expect(created(DeploymentEditor.addInstance(s, online, server, "spare", "0..1"))).toBe(`${online}.spare`);
  });

  it("are described as data, and run from arguments by name", () => {
    expect(Object.keys(editors)).toHaveLength(11);
    const { target, s, core } = game();
    const addEntity = findOperation("LanguageEditor", "addEntity")!;
    expect(addEntity.parameters.map((p) => [p.name, p.kind])).toEqual([["language", "element"], ["name", "text"]]);
    const edit = addEntity.run(s, { language: core, name: "Player" });
    expect(nameOf(target.graph, created(edit))).toBe("Player");
    expect(() => addEntity.run(s, { language: "nothing", name: "X" })).toThrow(ArgumentError);
    expect(() => findOperation("RelationshipEditor", "setRange")!.run(s, { end: core, range: "1..N" })).toThrow("expected the id of an End");
  });
});
