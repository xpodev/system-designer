/** The redesigned model in the core: extension, Components and their scope, and deletion. */
import { describe as group, expect, it } from "vitest";
import {
  Graph,
  coreGraph,
  coreSpec,
  counterexamples,
  analyzeFormula,
  boundInstance,
  importable,
  placeable,
  imported,
  mediationStack,
  parse,
  remove,
  scope,
  setMediationStack,
  setName,
  setParameters,
} from "../src/index.js";

group("extension", () => {
  const extended = () => {
    const graph = coreGraph();
    const entity = (language: string, id: string, name: string) => {
      graph.add("Entity", id);
      setName(graph, id, name);
      graph.connect(language, "entities", id);
    };
    for (const [id, name] of [["core", "Core"], ["combat", "Combat"]] as const) {
      graph.add("Language", id);
      setName(graph, id, name);
    }
    graph.connect("combat", "extends", "core");
    entity("core", "monster", "Monster");
    entity("combat", "fighter", "CombatMonster");
    graph.connect("fighter", "extends", "monster");
    graph.add("Relationship", "pack");
    graph.connect("core", "relationships", "pack");
    for (const name of ["leader", "followers"]) {
      graph.add("End", name);
      setName(graph, name, name);
      graph.connect(name, "entity", "monster");
      graph.connect("pack", "ends", name);
    }
    return graph;
  };

  it("reads a formula over its Language and every Language it extends", () => {
    const graph = extended();
    graph.add("Formula", "f", "all m in CombatMonster. not m in m.^leader");
    graph.connect("combat", "formulas", "f");
    const analysis = analyzeFormula(graph, "f");
    expect(analysis.ok && [...analysis.entities].sort()).toEqual(["fighter", "monster"]);
    expect(analysis.ok && analysis.ends).toEqual(["leader"]);
  });

  it("compares a projection with what it extends, and stays inside the Language's vocabulary", () => {
    const graph = extended();
    graph.add("Formula", "ok", "all f in CombatMonster, m in Monster. f == m => f in m.followers");
    graph.connect("combat", "formulas", "ok");
    expect(analyzeFormula(graph, "ok")).toMatchObject({ ok: true });
    graph.add("Formula", "outside", "all f in CombatMonster. f == f");
    graph.connect("core", "formulas", "outside");
    expect(analyzeFormula(graph, "outside")).toEqual({ ok: false, error: "unbound name 'CombatMonster'" });
  });

  it("finds an Entity extending one of its own Language's (W1), and an extension cycle (W4)", () => {
    const graph = extended();
    graph.add("Entity", "other");
    setName(graph, "other", "Other");
    graph.connect("core", "entities", "other");
    graph.connect("other", "extends", "monster");
    const failing = (id: string) =>
      coreSpec.axioms.filter((axiom) => axiom.id === id).flatMap((axiom) => counterexamples(parse(axiom.formula), graph).map((env) => [...env.values()]));
    expect(failing("W1")).toContainEqual(["other", "monster"]);
    graph.connect("core", "extends", "combat");
    expect(failing("W4")).toContainEqual(["core"]);
  });
});

/** A System: a root with two children, a Language at the root, and an Interaction of one child imported by the other. */
function system(): Graph {
  const graph = coreGraph();
  const component = (id: string, parent?: string) => {
    graph.add("Component", id);
    setName(graph, id, id);
    if (parent) graph.connect(id, "parent", parent);
  };
  graph.add("System", "s");
  setName(graph, "s", "S");
  component("root");
  graph.connect("s", "root", "root");
  component("server", "root");
  component("client", "root");
  graph.add("Language", "combat");
  setName(graph, "combat", "Combat");
  graph.connect("root", "languages", "combat");
  graph.add("Entity", "target");
  setName(graph, "target", "Target");
  graph.connect("combat", "entities", "target");
  for (const id of ["server", "client"]) graph.connect(id, "uses", "combat");
  graph.add("Interaction", "attack");
  setName(graph, "attack", "attack");
  graph.connect("attack", "component", "server");
  graph.connect("attack", "language", "combat");
  graph.connect("attack", "output", "target");
  exportOf(graph, "server:attack", "server", "interaction", "attack");
  importFrom(graph, "client<server", "client", "server", ["server:attack"]);
  return graph;
}

/** `exporter` exports `target` through `end` (an own thing, or a child). */
function exportOf(graph: Graph, id: string, exporter: string, end: string, target: string): void {
  graph.add("Export", id);
  graph.connect(exporter, "exports", id);
  graph.connect(id, end, target);
}

/** `importer` imports from `from`, taking `exports`. */
function importFrom(graph: Graph, id: string, importer: string, from: string, exports: readonly string[]): void {
  graph.add("Import", id);
  graph.connect(importer, "imports", id);
  graph.connect(id, "from", from);
  for (const exported of exports) graph.connect(id, "exports", exported);
}

function violated(graph: Graph): string[] {
  return coreSpec.axioms.filter((axiom) => counterexamples(parse(axiom.formula), graph).length > 0).map((axiom) => axiom.about);
}

group("components", () => {
  it("are well-formed as built", () => {
    expect(violated(system())).toEqual([]);
  });

  it("see their own and their parents' Languages, may import from any other Component, and reach what they import", () => {
    const graph = system();
    expect(scope(graph, "server")).toEqual(["combat"]);
    expect(importable(graph, "client")).toEqual(["root", "server"]);
    expect(imported(graph, "client")).toEqual(["attack"]);
  });

  it("cannot use a Language another Component does not export (W5), nor export what is not their own (W15)", () => {
    const graph = system();
    graph.add("Language", "private");
    setName(graph, "private", "Private");
    graph.connect("server", "languages", "private");
    graph.connect("client", "uses", "private");
    expect(violated(graph)).toContain("A Component uses only Languages in its scope: its own and its parents', and those it imports");
    exportOf(graph, "client:private", "client", "language", "private");
    expect(violated(graph)).toContain("A Component exports only its own Languages");
    exportOf(graph, "server:private", "server", "language", "private");
    graph.connect("client<server", "exports", "server:private");
    expect(violated(graph)).toEqual(["A Component exports only its own Languages"]);
  });

  it("import what is exported from anywhere, and place a Component its parent exports (W9, W10, W15)", () => {
    const graph = system();
    graph.add("Component", "inner");
    setName(graph, "inner", "inner");
    graph.connect("inner", "parent", "server");
    graph.connect("inner", "uses", "combat");
    graph.disconnect("attack", "component");
    graph.connect("attack", "component", "inner");
    expect(violated(graph)).toEqual(["A Component exports only its own Interactions"]);

    // The Export is inner's, and the Client imports it from inner, inside the Server: nesting does not scope it.
    graph.disconnect("server", "exports", "server:attack");
    graph.connect("inner", "exports", "server:attack");
    expect(violated(graph)).toContain("An Import takes only Exports of the Component it is from");
    graph.disconnect("client<server", "exports", "server:attack");
    importFrom(graph, "client<inner", "client", "inner", ["server:attack"]);
    expect(violated(graph)).toEqual([]);
    expect(imported(graph, "client")).toEqual(["attack"]);

    // Placing inner beyond the Server needs the Server to export it.
    graph.add("Deployment", "solo");
    setName(graph, "solo", "Solo");
    graph.connect("solo", "component", "client");
    graph.add("Instance", "one");
    setName(graph, "one", "one");
    graph.connect("one", "deployment", "solo");
    graph.connect("one", "of", "inner");
    expect(violated(graph)).toEqual(["An Instance of a Component from beyond what the deployed Component's ancestors hold is of one its parent exports"]);
    expect(placeable(graph, "client", "inner")).toBe(false);
    exportOf(graph, "server:inner", "server", "component", "inner");
    expect(violated(graph)).toEqual([]);
    expect(placeable(graph, "client", "inner")).toBe(true);
    expect(placeable(graph, "client", "server")).toBe(true);
  });
});

group("deletion", () => {
  it("removes an Export with what it exports; an Import keeps the rest, and goes with what it is from", () => {
    const graph = system();
    expect(remove(graph, "attack")).toEqual(expect.arrayContaining(["attack", "server:attack"]));
    expect(graph.has("client<server")).toBe(true);
    expect(graph.navigate("client<server", "exports")).toEqual([]);
    expect(remove(graph, "server")).toContain("client<server");
  });

  it("removes a Parameter with its type, and keeps its Transformation, ill-formed, for the diagnoser", () => {
    const graph = system();
    graph.add("Language", "net");
    setName(graph, "net", "Net");
    graph.connect("root", "languages", "net");
    graph.add("Entity", "id");
    setName(graph, "id", "Id");
    graph.connect("net", "entities", "id");
    graph.add("Transformation", "down");
    setName(graph, "down", "down");
    graph.connect("down", "component", "root");
    graph.add("Parameter", "p");
    setName(graph, "p", "target");
    graph.connect("p", "type", "target");
    setParameters(graph, "down", ["p"]);
    graph.connect("down", "output", "id");
    expect(remove(graph, "combat")).toEqual(expect.arrayContaining(["combat", "target", "attack", "p"]));
    expect(graph.has("down")).toBe(true);
    expect(graph.navigate("down", "parameters")).toEqual([]);
  });

  it("finds an implementation that does not import what it implements (W14)", () => {
    const graph = system();
    graph.connect("client", "implements", "server");
    graph.disconnect("client", "imports", "client<server");
    expect(violated(graph)).toContain("A Component imports what it implements");
    graph.connect("client", "imports", "client<server");
    expect(violated(graph)).not.toContain("A Component imports what it implements");
  });

  it("finds an Instance whose range is out of order (W2)", () => {
    const graph = system();
    graph.add("Deployment", "d");
    graph.connect("d", "component", "root");
    graph.add("Instance", "i");
    setName(graph, "i", "i");
    graph.connect("i", "of", "server");
    graph.connect("d", "instances", "i");
    graph.connect("i", "min", boundInstance(graph, 2));
    graph.connect("i", "max", boundInstance(graph, 1));
    expect(violated(graph)).toContain("An Instance's min <= max, where max is present");
  });

  it("removes a Connection with its last Interaction, and keeps a Mediation whose Medium goes", () => {
    const graph = system();
    graph.add("Deployment", "d");
    graph.connect("d", "component", "root");
    for (const [id, of] of [["c1", "client"], ["s1", "server"]] as const) {
      graph.add("Instance", id);
      setName(graph, id, id);
      graph.connect(id, "of", of);
      graph.connect("d", "instances", id);
    }
    graph.add("Connection", "wire");
    graph.connect("d", "connections", "wire");
    graph.connect("wire", "from", "c1");
    graph.connect("wire", "to", "s1");
    graph.connect("wire", "what", "attack");
    graph.add("Medium", "http");
    graph.connect("http", "component", "root");
    graph.add("Mediation", "m");
    graph.connect("m", "how", "http");
    setMediationStack(graph, "wire", ["m"]);
    expect(mediationStack(graph, "wire")).toEqual(["m"]);
    remove(graph, "http");
    expect(graph.has("m")).toBe(true);
    expect(graph.navigate("m", "how")).toEqual([]);
    remove(graph, "attack");
    expect(graph.has("wire")).toBe(false);
    expect(graph.has("m")).toBe(false);
  });
});
