import { nameOf, parameters } from "@systemathic/core";
import { diagnose } from "@systemathic/diagnoser";
import { Target, undo } from "@systemathic/editing";
import { newSystem } from "@systemathic/tool";
import { describe, expect, it } from "vitest";
import {
  ArgumentError,
  DomainEditor,
  EntityEditor,
  FormulaEditor,
  InteractionEditor,
  InteractionMappingEditor,
  LanguageEditor,
  RelationshipEditor,
  StdEditor,
  SystemEditor,
  TransformationEditor,
  editors,
  findOperation,
} from "../src/index.js";

const created = (edit: { elements: readonly string[] }) => edit.elements[0]!;

/** The game of docs/foundation.md, built through the editors. */
function game() {
  const target = new Target(newSystem("Game"));
  const s = target.startSession("test");
  const core = created(SystemEditor.addLanguage(s, "system", "Core"));
  const monster = created(LanguageEditor.addEntity(s, core, "Monster"));
  const pack = created(
    LanguageEditor.addRelationship(s, core, { entity: monster, name: "leader", range: "0..1" }, { entity: monster, name: "followers", range: "0..N" }),
  );
  const acyclic = created(LanguageEditor.addFormula(s, core, "all m in Monster. not m in m.^leader", pack));
  const combat = created(SystemEditor.addLanguage(s, "system", "Combat"));
  const attacker = created(LanguageEditor.addEntity(s, combat, "Attacker"));
  const damage = created(LanguageEditor.addEntity(s, combat, "Damage"));
  const attack = created(InteractionEditor.addInteraction(s, combat, "attack", damage));
  const by = created(InteractionEditor.addParameter(s, attack, "by", attacker));
  const unity = created(SystemEditor.addLanguage(s, "system", "Unity"));
  const component = created(LanguageEditor.addEntity(s, unity, "Component"));
  const send = created(InteractionEditor.addInteraction(s, unity, "send", component));
  InteractionEditor.addParameter(s, send, "to", component);

  const dCore = created(SystemEditor.addDomain(s, "system", "Core"));
  DomainEditor.reference(s, dCore, core);
  const dCombat = created(SystemEditor.addDomain(s, "system", "Combat"));
  DomainEditor.reference(s, dCombat, combat);
  DomainEditor.reference(s, dCombat, dCore);
  const view = created(DomainEditor.addTransformation(s, dCombat, "Monsters in combat", core, combat));
  TransformationEditor.mapEntity(s, view, monster, [attacker]);
  const dUnity = created(SystemEditor.addDomain(s, "system", "Unity"));
  DomainEditor.reference(s, dUnity, unity);
  const dMediator = created(SystemEditor.addDomain(s, "system", "CombatInUnity"));
  DomainEditor.reference(s, dMediator, combat);
  DomainEditor.reference(s, dMediator, unity);
  const witness = created(DomainEditor.addTransformation(s, dMediator, "Combat as components", combat, unity));
  TransformationEditor.setReverse(s, witness, true);
  for (const entity of [attacker, damage]) TransformationEditor.mapEntity(s, witness, entity, [component]);
  InteractionMappingEditor.mapInteraction(s, witness, attack, [send]);
  const mediation = created(SystemEditor.addMediation(s, "system", dCombat, dUnity, dMediator));
  StdEditor.setPrimary(s, attack, by);
  return { target, s, core, monster, pack, acyclic, combat, attacker, damage, attack, by, unity, dCore, dCombat, view, witness, mediation };
}

const wrong = (target: Target) => diagnose(target.context).map((d) => d.check);

describe("concept editors", () => {
  it("build a well-formed System, all on one History", () => {
    const { target, attack, by } = game();
    expect(diagnose(target.context)).toEqual([]);
    expect(parameters(target.graph, attack)).toEqual([by]);
    expect(target.history.edits.every((edit) => edit.elements.length > 0)).toBe(true);
  });

  it("record only what an operation touched, not Formulas whose mentions did not change", () => {
    const { s, core } = game();
    expect(LanguageEditor.addEntity(s, core, "Loot").elements).toEqual([`${core}.loot`, core]);
  });

  it("keep Formulas' mentions in step with renames", () => {
    const { target, s, pack, acyclic } = game();
    const leader = target.graph.navigate(pack, "ends")[0]!;
    RelationshipEditor.renameEnd(s, leader, "boss");
    expect(wrong(target)).toEqual(["formula"]);
    FormulaEditor.setText(s, acyclic, "all m in Monster. not m in m.^boss");
    expect(wrong(target)).toEqual([]);
    expect(target.graph.navigate(acyclic, "mentionedEnds")).toEqual([leader]);
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
    const { target, s, combat, view, witness, mediation } = game();
    LanguageEditor.remove(s, combat);
    for (const id of [view, witness, mediation]) expect(target.graph.has(id)).toBe(false);
    undo(s);
    expect(diagnose(target.context)).toEqual([]);
    expect(target.graph.has(mediation)).toBe(true);
  });

  it("leave a Mediation unwitnessed when its reverse is taken away", () => {
    const { target, s, witness, mediation } = game();
    TransformationEditor.setReverse(s, witness, false);
    expect(target.graph.has(mediation)).toBe(true);
    expect(wrong(target)).toEqual(["W6"]);
  });

  it("order Parameters", () => {
    const { target, s, attack, by, attacker } = game();
    const second = created(InteractionEditor.addParameter(s, attack, "with", attacker));
    const first = created(InteractionEditor.addParameter(s, attack, "first", attacker, 0));
    expect(parameters(target.graph, attack)).toEqual([first, by, second]);
    InteractionEditor.moveParameter(s, first, 2);
    expect(parameters(target.graph, attack)).toEqual([by, second, first]);
    InteractionEditor.removeParameter(s, by);
    expect(parameters(target.graph, attack)).toEqual([second, first]);
    expect(target.graph.navigate(attack, "primary")).toEqual([]);
  });

  it("defer and undefer", () => {
    const { target, s, view, monster } = game();
    const deferral = created(StdEditor.defer(s, view, monster));
    expect(target.graph.navigate(view, "deferred")).toEqual([deferral]);
    StdEditor.undefer(s, view, monster);
    expect(target.graph.navigate(view, "deferred")).toEqual([]);
  });

  it("removing an Entity removes its mappings", () => {
    const { target, s, view, monster } = game();
    EntityEditor.remove(s, monster);
    expect(target.graph.navigate(view, "entityMappings")).toEqual([]);
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
