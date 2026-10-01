import { readFileSync } from "node:fs";
import { describe as group, expect, it } from "vitest";
import { generate } from "../../../scripts/generate-schema.js";
import {
  Graph,
  Vocabulary,
  boundInstance,
  coreGraph,
  coreSpec,
  coreVocabulary,
  counterexamples,
  invert,
  holds,
  linkMentions,
  nameInstance,
  nameOf,
  parameters,
  parse,
  setName,
  setParameters,
  typecheck,
} from "../src/index.js";

group("generated schema", () => {
  it("is up to date with schema/*.json", () => {
    const onDisk = readFileSync(new URL("../src/generated/schema.ts", import.meta.url), "utf8");
    expect(onDisk.replace(/\r\n/g, "\n")).toBe(generate());
  });

  it("holds the union of Kernel, Contexts and Operations", () => {
    expect(coreSpec.entities).toHaveLength(17);
    expect(coreSpec.relationships).toHaveLength(47);
    expect(coreSpec.axioms).toHaveLength(29);
  });
});

group("logic", () => {
  it("parses and type-checks every axiom of the core", () => {
    for (const axiom of coreSpec.axioms) {
      expect(() => typecheck(parse(axiom.formula), coreVocabulary), axiom.formula).not.toThrow();
    }
  });

  it("rejects what check.py rejects", () => {
    const bad = [
      ["all r in Relationship, e in r.ends. e.entity.langauge == r.language", "has no end 'langauge'"],
      ["all i in Interaction. i.output == i.language", "compares Entity with Language"],
      ["all i in Interaction. j.output.language == i.language", "unbound name 'j'"],
      ["all t in Transformation. t.source in t.^holder.languages", "closure over Transformation.holder"],
      ["all x in", "expected"],
    ] as const;
    for (const [text, message] of bad) {
      expect(() => typecheck(parse(text), coreVocabulary), text).toThrow(message);
    }
  });

  const chain = new Vocabulary({
    entities: ["Node"],
    relationships: [{ id: "r", ends: [{ name: "prev", entity: "Node", min: 0, max: 1 }, { name: "next", entity: "Node", min: 0, max: 1 }] }],
    axioms: [],
  });
  const line = () => {
    const graph = new Graph(chain);
    for (const id of ["a", "b", "c"]) graph.add("Node", id);
    graph.connect("a", "next", "b");
    graph.connect("b", "next", "c");
    return graph;
  };

  it("evaluates navigation, closure, emptiness and inclusion", () => {
    const graph = line();
    expect(holds(parse("all n in Node. not n in n.^next"), graph)).toBe(true);
    expect(holds(parse("some n in Node. no n.prev"), graph)).toBe(true);
    expect(holds(parse("all n in Node, m in n.next. n in m.prev"), graph)).toBe(true);
    expect(holds(parse("all n in Node. n in n.*next"), graph)).toBe(true);
    expect(holds(parse("some n in Node. some n.next.next"), graph)).toBe(true);
  });

  it("reports the assignments that falsify an axiom", () => {
    const graph = line();
    graph.connect("c", "next", "a");
    const found = counterexamples(parse("all n in Node. not n in n.^next"), graph);
    expect(found.map((env) => env.get("n"))).toEqual(["a", "b", "c"]);
  });
});

group("graph", () => {
  it("navigates a self-relationship both ways, and clones", () => {
    const graph = coreGraph();
    graph.add("Parameter", "p1");
    graph.add("Parameter", "p2");
    graph.connect("p1", "next", "p2");
    expect(graph.navigate("p1", "next")).toEqual(["p2"]);
    expect(graph.navigate("p2", "prev")).toEqual(["p1"]);
    expect(graph.clone().navigate("p2", "prev")).toEqual(["p1"]);
  });

  it("keeps parameters in order through the first/next chain", () => {
    const graph = coreGraph();
    graph.add("Interaction", "i");
    for (const id of ["x", "y", "z"]) graph.add("Parameter", id);
    setParameters(graph, "i", ["y", "x", "z"]);
    expect(parameters(graph, "i")).toEqual(["y", "x", "z"]);
    setParameters(graph, "i", ["z", "y"]);
    expect(parameters(graph, "i")).toEqual(["z", "y"]);
  });
});

group("changes", () => {
  it("records what a change did, and undoes it in place", () => {
    const graph = coreGraph();
    graph.add("Language", "l");
    for (const id of ["a", "b", "c"]) {
      graph.add("Entity", id);
      graph.connect("l", "entities", id);
    }
    const delta = graph.record((g) => g.remove("b"));
    expect(delta.map((change) => change.op)).toEqual(["unlink", "remove"]);
    expect(graph.navigate("l", "entities")).toEqual(["a", "c"]);
    graph.apply(invert(delta));
    expect(graph.navigate("l", "entities")).toEqual(["a", "b", "c"]);
  });

  it("applies as much of a delta as still applies", () => {
    const graph = coreGraph();
    graph.add("Language", "l");
    graph.add("Entity", "e");
    const delta = graph.record((g) => g.connect("l", "entities", "e"));
    graph.remove("e");
    expect(graph.apply(invert(delta))).toEqual([]);
    expect(graph.apply(delta)).toEqual([]);
  });

  it("does not record links that change nothing", () => {
    const graph = coreGraph();
    graph.add("Language", "l");
    graph.add("Entity", "e");
    graph.connect("l", "entities", "e");
    expect(graph.record((g) => g.connect("l", "entities", "e"))).toEqual([]);
  });
});

group("values", () => {
  it("interns names, so equal text is one identity", () => {
    const graph = coreGraph();
    graph.add("Entity", "e1");
    graph.add("Entity", "e2");
    setName(graph, "e1", "Order");
    setName(graph, "e2", "Order");
    expect(graph.navigate("e1", "name")).toEqual(graph.navigate("e2", "name"));
    expect(nameInstance(graph, "Order")).toBe("name:Order");
    expect(nameOf(graph, "e2")).toBe("Order");
  });

  it("materializes bounds so the ranges axiom can compare them", () => {
    const graph = coreGraph();
    graph.add("End", "good");
    graph.add("End", "bad");
    graph.connect("good", "min", boundInstance(graph, 1));
    graph.connect("good", "max", boundInstance(graph, 3));
    graph.connect("bad", "min", boundInstance(graph, 2));
    graph.connect("bad", "max", boundInstance(graph, 1));
    const ranges = coreSpec.axioms.find((axiom) => axiom.id === "W2")!;
    const found = counterexamples(parse(ranges.formula), graph);
    expect(found.map((env) => env.get("e"))).toEqual(["bad"]);
  });
});

group("formulas", () => {
  const orders = () => {
    const graph = coreGraph();
    graph.add("Language", "commerce");
    setName(graph, "commerce", "Commerce");
    for (const [id, name] of [["order", "Order"], ["line", "OrderLine"]] as const) {
      graph.add("Entity", id);
      setName(graph, id, name);
      graph.connect("commerce", "entities", id);
    }
    graph.add("Relationship", "lines");
    graph.connect("commerce", "relationships", "lines");
    for (const [id, name, entity] of [["end-order", "order", "order"], ["end-lines", "lines", "line"]] as const) {
      graph.add("End", id);
      setName(graph, id, name);
      graph.connect(id, "entity", entity);
      graph.connect("lines", "ends", id);
    }
    return graph;
  };

  it("derives mentions from the text", () => {
    const graph = orders();
    graph.add("Formula", "f", "all o in Order, l in o.lines. l.order == o");
    graph.connect("commerce", "formulas", "f");
    expect(linkMentions(graph, "f")).toMatchObject({ ok: true });
    expect(graph.navigate("f", "mentionedEntities").sort()).toEqual(["line", "order"]);
    expect(graph.navigate("f", "mentionedEnds").sort()).toEqual(["end-lines", "end-order"]);
  });

  it("derives mentions whatever characters the ids contain", () => {
    const graph = coreGraph();
    graph.add("Language", "lang:A");
    graph.add("Entity", "ent:A.Node");
    setName(graph, "ent:A.Node", "Node");
    graph.connect("lang:A", "entities", "ent:A.Node");
    graph.add("Relationship", "rel:A#0");
    graph.connect("lang:A", "relationships", "rel:A#0");
    for (const name of ["prev", "next"]) {
      graph.add("End", `rel:A#0.${name}`);
      setName(graph, `rel:A#0.${name}`, name);
      graph.connect(`rel:A#0.${name}`, "entity", "ent:A.Node");
      graph.connect("rel:A#0", "ends", `rel:A#0.${name}`);
    }
    graph.add("Formula", "f:A#0", "all n in Node. not n in n.^next");
    graph.connect("lang:A", "formulas", "f:A#0");
    expect(linkMentions(graph, "f:A#0")).toMatchObject({ ok: true });
    expect(graph.navigate("f:A#0", "mentionedEnds")).toEqual(["rel:A#0.next"]);
  });

  it("reports a formula that leaves its Language", () => {
    const graph = orders();
    graph.add("Formula", "f", "all o in Order. o.customer == o");
    graph.connect("commerce", "formulas", "f");
    expect(linkMentions(graph, "f")).toEqual({ ok: false, error: "Order has no end 'customer'" });
    expect(graph.navigate("f", "mentionedEntities")).toEqual([]);
  });
});
