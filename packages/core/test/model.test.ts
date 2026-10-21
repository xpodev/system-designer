/** The redesigned model in the core: extension, Components and their scope, and deletion. */
import { describe as group, expect, it } from "vitest";
import {
  Graph,
  coreGraph,
  coreSpec,
  counterexamples,
  analyzeFormula,
  boundInstance,
  identityPath,
  identityTarget,
  importable,
  imported,
  isInterface,
  placeable,
  placeableIn,
  mediationStack,
  parse,
  remove,
  scope,
  setMediationStack,
  setName,
  setIdentitySteps,
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

  it("removes a Relationship with an Entity at either end; what extended the Entity only loses it", () => {
    const graph = extended();
    graph.add("Entity", "pet");
    setName(graph, "pet", "Pet");
    graph.connect("core", "entities", "pet");
    graph.add("Relationship", "owns");
    graph.connect("core", "relationships", "owns");
    for (const [end, entity] of [["owner", "monster"], ["owned", "pet"]] as const) {
      graph.add("End", end);
      graph.connect(end, "entity", entity);
      graph.connect("owns", "ends", end);
    }
    expect(remove(graph, "pet").sort()).toEqual(["owned", "owner", "owns", "pet"]);
    expect(graph.navigate("monster", "ends").sort()).toEqual(["followers", "leader"]);
    expect(remove(graph, "monster")).toEqual(expect.arrayContaining(["pack", "leader", "followers"]));
    expect(graph.has("fighter")).toBe(true);
    expect(graph.navigate("fighter", "extends")).toEqual([]);
    expect(graph.ofEntity("End")).toEqual([]);
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

/**
 * A System: a root with two boxes, Server and Client, a Language at the root, and the root's
 * Deployment, `d`, placing `c1` and `s1` and connecting them over Server's `attack`.
 */
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
  deployment(graph, "d", "root");
  instance(graph, "c1", "d", "client");
  instance(graph, "s1", "d", "server");
  graph.add("Connection", "wire");
  graph.connect("d", "connections", "wire");
  graph.connect("wire", "from", "c1");
  graph.connect("wire", "to", "s1");
  graph.connect("wire", "what", "attack");
  return graph;
}

/** A Deployment of `box`, kept in `keeper` (the box itself, unless given). */
function deployment(graph: Graph, id: string, box: string, keeper = box): void {
  graph.add("Deployment", id);
  setName(graph, id, id);
  graph.connect(id, "component", box);
  graph.connect(id, "keeper", keeper);
}

function instance(graph: Graph, id: string, deployment: string, of: string): void {
  graph.add("Instance", id);
  setName(graph, id, id);
  graph.connect(id, "of", of);
  graph.connect(deployment, "instances", id);
  graph.connect(id, "min", boundInstance(graph, 1));
}

/** `exporter` — a Component, or a Deployment exposing a placement — exports `target` through `end`. */
function exportOf(graph: Graph, id: string, exporter: string, end: string, target: string): void {
  graph.add("Export", id);
  graph.connect(exporter, graph.get(exporter).entity === "Deployment" ? "exposes" : "exports", id);
  graph.connect(id, end, target);
}

/** `importer` — a Component or a Deployment — imports from `from`, taking `exports`. */
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

  it("see their own and their parents' Languages, may import from any other Component, and lay out boxes in scope", () => {
    const graph = system();
    expect(scope(graph, "server")).toEqual(["combat"]);
    expect(importable(graph, "client")).toEqual(["root", "server"]);
    expect(placeableIn(graph, "d").sort()).toEqual(["client", "server"]);
    expect(isInterface(graph, "server")).toBe(true);
    expect(isInterface(graph, "root")).toBe(false);
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
    importFrom(graph, "client<server", "client", "server", ["server:private"]);
    expect(violated(graph)).toEqual(["A Component exports only its own Languages"]);
  });

  it("import only vocabulary; what calls is a Deployment, and imports what it needs (W9)", () => {
    const graph = system();
    importFrom(graph, "client<server", "client", "server", ["server:attack"]);
    expect(violated(graph)).toEqual(["A Component imports only vocabulary: its Imports take only Languages"]);
    graph.disconnect("client", "imports", "client<server");
    deployment(graph, "desktop", "client");
    graph.connect("desktop", "imports", "client<server");
    expect(violated(graph)).toEqual([]);
    expect(imported(graph, "desktop")).toEqual(["attack"]);
  });
});

group("deployments", () => {
  it("place only boxes in their scope (W10), and run only a Deployment of their own box", () => {
    const graph = system();
    graph.add("Component", "inner");
    setName(graph, "inner", "inner");
    graph.connect("inner", "parent", "server");
    deployment(graph, "solo", "client");
    instance(graph, "one", "solo", "inner");
    expect(violated(graph)).toContain(
      "An Instance is of a box in its Deployment's scope: a child of its box or of the box's ancestors, a child of its keeper or of the keeper's ancestors, or a top-level Component the Deployment imports",
    );
    expect(placeable(graph, "solo", "inner")).toBe(false);
    expect(placeable(graph, "solo", "server")).toBe(true);
    graph.disconnect("one", "of");
    graph.connect("one", "of", "server");
    expect(violated(graph)).toEqual([]);
    graph.connect("one", "runs", "solo");
    expect(violated(graph)).toEqual(["An Instance runs only a Deployment of its own box"]);
  });

  it("may be kept outside their box, by a plug-in that imports the box", () => {
    const graph = system();
    graph.add("Component", "plugin");
    setName(graph, "plugin", "plugin");
    graph.connect("s", "packages", "plugin");
    graph.add("Component", "helper");
    setName(graph, "helper", "helper");
    graph.connect("helper", "parent", "plugin");
    deployment(graph, "fast", "server", "plugin");
    instance(graph, "h", "fast", "helper");
    expect(violated(graph)).toEqual(["A Deployment kept outside its box imports the box"]);
    exportOf(graph, "root:server", "root", "component", "server");
    importFrom(graph, "fast<root", "fast", "root", ["root:server"]);
    expect(violated(graph)).toEqual([]);
    expect(placeableIn(graph, "fast")).toContain("helper");
    // The box goes, and its Deployments with it, wherever they are kept.
    expect(remove(graph, "server")).toEqual(expect.arrayContaining(["fast", "h"]));
  });

  it("reach a real object through an identity: a path of exposed placements from the root (W16)", () => {
    const graph = system();
    graph.add("Component", "plugin");
    setName(graph, "plugin", "plugin");
    graph.connect("s", "packages", "plugin");
    graph.add("Component", "caller");
    setName(graph, "caller", "caller");
    graph.connect("caller", "parent", "plugin");
    deployment(graph, "layout", "plugin");
    instance(graph, "k", "layout", "caller");
    graph.add("Import", "to-server");
    graph.connect("layout", "imports", "to-server");
    graph.add("Step", "step");
    graph.connect("step", "instance", "s1");
    setIdentitySteps(graph, "to-server", ["step"]);
    graph.add("Connection", "call");
    graph.connect("layout", "connections", "call");
    graph.connect("call", "from", "k");
    graph.connect("call", "toIdentity", "to-server");
    graph.connect("call", "what", "attack");
    expect(violated(graph)).toEqual(["Each Step is a placement its Deployment exposes"]);
    exportOf(graph, "d:s1", "d", "instance", "s1");
    expect(violated(graph)).toEqual([]);
    expect(identityPath(graph, "to-server")).toEqual(["s1"]);
    expect(identityTarget(graph, "to-server")).toBe("s1");
    // The placement goes: its Step, the identity, and the Connection to it with it.
    expect(remove(graph, "s1")).toEqual(expect.arrayContaining(["s1", "step", "to-server", "call", "d:s1"]));
  });
});

group("deletion", () => {
  it("removes an Export with what it exports; an Import keeps the rest, and goes with what it is from", () => {
    const graph = system();
    deployment(graph, "desktop", "client");
    importFrom(graph, "client<server", "desktop", "server", ["server:attack"]);
    expect(remove(graph, "attack")).toEqual(expect.arrayContaining(["attack", "server:attack", "wire"]));
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

  it("finds an Instance whose range is out of order (W2)", () => {
    const graph = system();
    graph.disconnect("s1", "min");
    graph.connect("s1", "min", boundInstance(graph, 2));
    graph.connect("s1", "max", boundInstance(graph, 1));
    expect(violated(graph)).toContain("An Instance's min <= max, where max is present");
  });

  it("removes a Connection with its last Interaction, and keeps a Mediation whose Medium goes", () => {
    const graph = system();
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
