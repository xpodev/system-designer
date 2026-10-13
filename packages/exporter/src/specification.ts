/**
 * Specification: a design, exported as a contract for validators. A
 * Statement is a design fact — a Language's vocabulary, what a Component may use and import,
 * how its Deployments connect its parts; a Requirement is a design rule, from the profile the
 * design was verified against; an Obligation is what an implementation must satisfy that no
 * design check can (foundation.md, O1–O5), for specific Subjects. Every part has an id that
 * stays the same as long as the Elements it is about do, so a validator can refer to it.
 */
import { describe as describeElement, mediationStack, nameOf, parameters, scope, type Graph } from "@systemathic/core";
import type { SystemContext } from "@systemathic/tool";
import type { Profile } from "@systemathic/verifier";

export interface Statement {
  readonly id: string;
  readonly text: string;
  /** Ids of the Elements it is about. */
  readonly subjects: readonly string[];
}

export interface Section {
  readonly id: string;
  readonly title: string;
  readonly statements: readonly Statement[];
  readonly sections: readonly Section[];
}

export interface Requirement {
  readonly id: string;
  readonly rule: string;
  readonly severity: "error" | "warning";
  readonly about: string;
  readonly script: string;
}

export type ObligationKind = "O1" | "O2" | "O3" | "O4" | "O5";

export interface Obligation {
  readonly id: string;
  readonly kind: ObligationKind;
  readonly text: string;
  readonly subjects: readonly string[];
}

export interface Specification {
  readonly system: string;
  readonly sections: readonly Section[];
  readonly requirements: readonly Requirement[];
  readonly obligations: readonly Obligation[];
}

const name = (graph: Graph, id: string | undefined) => (id === undefined ? "?" : (nameOf(graph, id) ?? describeElement(graph, id)));
const names = (graph: Graph, ids: readonly string[]) => ids.map((id) => name(graph, id)).join(", ") || "none";
const first = (graph: Graph, id: string, end: string) => graph.navigate(id, end)[0];
const statement = (id: string, text: string, ...subjects: string[]): Statement => ({ id, text, subjects });

function range(graph: Graph, end: string): string {
  const [min] = graph.navigate(end, "min");
  const [max] = graph.navigate(end, "max");
  return `${min === undefined ? "?" : graph.get(min).value}..${max === undefined ? "N" : graph.get(max).value}`;
}

function language(graph: Graph, id: string): Section {
  const statements: Statement[] = [];
  const extended = graph.navigate(id, "extends");
  if (extended.length > 0) statements.push(statement(`extends:${id}`, `Extends ${names(graph, extended)}: its vocabulary is its own and theirs.`, id, ...extended));
  for (const entity of graph.navigate(id, "entities")) {
    const bases = graph.navigate(entity, "extends");
    const projection = bases.length === 0 ? "" : `, extending ${names(graph, bases)}: each of its instances is one of theirs`;
    statements.push(statement(`entity:${entity}`, `Entity ${name(graph, entity)}${projection}.`, entity, ...bases));
  }
  for (const relationship of graph.navigate(id, "relationships")) {
    const ends = graph.navigate(relationship, "ends");
    const sides = ends.map((end) => {
      const at = name(graph, first(graph, end, "entity"));
      return nameOf(graph, end) === undefined ? `${at} (an unnamed end, ${range(graph, end)})` : `${at} (end '${nameOf(graph, end)}', ${range(graph, end)})`;
    });
    const ways = ends.map((end, i) => {
      const from = name(graph, first(graph, ends[1 - i]!, "entity"));
      return nameOf(graph, end) === undefined ? `no ${from} reaches its ${name(graph, first(graph, end, "entity"))}` : `${from}.${nameOf(graph, end)}`;
    });
    statements.push(statement(`relationship:${relationship}`, `Relationship ${sides.join(" <——> ")}: ${ways.reverse().join("; ")}.`, relationship, ...ends));
  }
  for (const formula of graph.navigate(id, "formulas")) statements.push(statement(`axiom:${formula}`, `Axiom: ${String(graph.get(formula).value ?? "")}`, formula));
  return { id: `language:${id}`, title: `Language ${name(graph, id)}`, statements, sections: [] };
}

/** A Function's signature: `attack(by: Attacker): Damage`, or with nothing after it when it gives nothing back. */
function signature(graph: Graph, func: string): string {
  const params = parameters(graph, func).map((p) => `${name(graph, p)}: ${name(graph, first(graph, p, "type"))}`).join(", ");
  const output = first(graph, func, "output");
  return `${name(graph, func)}(${params})${output === undefined ? "" : `: ${name(graph, output)}`}`;
}

/** A Transformation's source Language, its inputs', and its target, its output's. */
function source(graph: Graph, t: string): string | undefined {
  const [input] = parameters(graph, t);
  const type = input === undefined ? undefined : first(graph, input, "type");
  return type === undefined ? undefined : first(graph, type, "language");
}

function target(graph: Graph, t: string): string | undefined {
  const output = first(graph, t, "output");
  return output === undefined ? undefined : first(graph, output, "language");
}

function interactionStatement(graph: Graph, interaction: string): Statement {
  const gives = first(graph, interaction, "output") === undefined ? " It gives nothing back." : "";
  const text = `Interaction ${signature(graph, interaction)}, over ${name(graph, first(graph, interaction, "language"))}.${gives}`;
  return statement(`interaction:${interaction}`, text, interaction);
}

function transformationStatement(graph: Graph, t: string): Statement {
  return statement(`transformation:${t}`, `Transformation ${signature(graph, t)}: from ${name(graph, source(graph, t))} to ${name(graph, target(graph, t))}.`, t);
}

/** How a Connection passes, in a sentence. */
function mediationText(graph: Graph, connection: string): string {
  const stack = mediationStack(graph, connection);
  if (stack.length === 0) return "how it passes is an implementation detail";
  const levels = stack.map((m) => {
    const down = first(graph, m, "down");
    const up = first(graph, m, "up");
    const realized = down === undefined && up === undefined ? "" : ` (down by ${name(graph, down)}, up by ${name(graph, up)})`;
    return `${name(graph, first(graph, m, "how"))}${realized}`;
  });
  return `it passes over ${levels.join(", then ")}`;
}

function deploymentStatements(graph: Graph, deployment: string): Statement[] {
  const instances = graph.navigate(deployment, "instances");
  const placed =
    instances
      .map((i) => {
        const occupants = range(graph, i);
        return `${name(graph, i)} (${name(graph, first(graph, i, "of"))}${occupants === "1..1" ? "" : `, ${occupants} of them`})`;
      })
      .join(", ") || "nothing";
  const statements = [statement(`deployment:${deployment}`, `Deployment ${name(graph, deployment)} places ${placed}.`, deployment, ...instances)];
  for (const connection of graph.navigate(deployment, "connections")) {
    const from = first(graph, connection, "from");
    const to = first(graph, connection, "to") ?? first(graph, connection, "toComponent");
    const what = graph.navigate(connection, "what");
    const stack = mediationStack(graph, connection);
    statements.push(
      statement(
        `connection:${connection}`,
        `In ${name(graph, deployment)}, ${name(graph, from)} uses ${names(graph, what)} of ${name(graph, to)}; ${mediationText(graph, connection)}.`,
        connection,
        ...[from, to].filter((x): x is string => x !== undefined),
        ...what,
        ...stack,
      ),
    );
  }
  return statements;
}

const IMPORTS = [
  ["importedComponents", "the Components"],
  ["importedInteractions", "the Interactions"],
  ["importedTransformations", "the Transformations"],
  ["importedMediums", "the Mediums"],
] as const;

function component(graph: Graph, id: string): Section {
  const uses = graph.navigate(id, "uses");
  const visible = scope(graph, id);
  const imported = IMPORTS.flatMap(([end]) => graph.navigate(id, end));
  const importText = IMPORTS.map(([end, label]) => `${label} ${names(graph, graph.navigate(id, end))}`).join("; ");
  const statements: Statement[] = [
    statement(`uses:${id}`, `Uses the Languages ${names(graph, uses)}.`, id, ...uses),
    statement(`scope:${id}`, `May use exactly the Languages ${names(graph, visible)}, and nothing else.`, id, ...visible),
    statement(`imports:${id}`, `Imports ${importText}; it reaches nothing else of any other Component.`, id, ...imported),
    ...graph.navigate(id, "implements").map((x) =>
      statement(`implements:${id}:${x}`, `Implements ${name(graph, x)}: it may stand wherever ${name(graph, x)} is placed.`, id, x),
    ),
    ...graph.navigate(id, "interactions").map((i) => interactionStatement(graph, i)),
    ...graph.navigate(id, "transformations").map((t) => transformationStatement(graph, t)),
    ...graph.navigate(id, "mediums").map((m) =>
      statement(`medium:${m}`, `Medium ${name(graph, m)}: a What passes over ${name(graph, first(graph, m, "language"))}, through ${name(graph, first(graph, m, "call"))}.`, m),
    ),
    ...graph.navigate(id, "deployments").flatMap((d) => deploymentStatements(graph, d)),
  ];
  const sections = [...graph.navigate(id, "languages").map((l) => language(graph, l)), ...graph.navigate(id, "components").map((c) => component(graph, c))];
  return { id: `component:${id}`, title: `Component ${name(graph, id)}`, statements, sections };
}

function obligations(graph: Graph): Obligation[] {
  const found: Obligation[] = [];
  for (const language of graph.ofEntity("Language")) {
    found.push({ id: `O1:${language}`, kind: "O1", text: `Every instance of ${name(graph, language)} satisfies its ranges and axioms, and those of every extension in use.`, subjects: [language] });
  }
  const realizations = new Set<string>();
  for (const mediation of graph.ofEntity("Mediation")) {
    const down = first(graph, mediation, "down");
    const up = first(graph, mediation, "up");
    if (down === undefined || up === undefined || realizations.has(`${down} ${up}`)) continue;
    realizations.add(`${down} ${up}`);
    found.push({
      id: `O2:${down}`,
      kind: "O2",
      text: `${name(graph, up)} gives back what ${name(graph, down)} was given: an equivalent ${name(graph, source(graph, down))} instance.`,
      subjects: [down, up],
    });
  }
  for (const t of graph.ofEntity("Transformation")) {
    const from = source(graph, t);
    if (from !== undefined && graph.navigate(from, "formulas").length > 0) {
      found.push({ id: `O3:${t}`, kind: "O3", text: `${name(graph, t)} preserves the axioms of ${name(graph, from)}.`, subjects: [t, from] });
    }
  }
  for (const entity of graph.ofEntity("Entity")) {
    const extended = graph.navigate(entity, "extends");
    if (extended.length > 0) {
      found.push({ id: `O4:${entity}`, kind: "O4", text: `An instance of ${name(graph, entity)} is the same instance as each of ${names(graph, extended)}.`, subjects: [entity, ...extended] });
    }
  }
  for (const component of graph.ofEntity("Component")) {
    for (const implemented of graph.navigate(component, "implements")) {
      found.push({
        id: `O5:${component}:${implemented}`,
        kind: "O5",
        text: `${name(graph, component)} offers every Interaction of ${name(graph, implemented)}, as it is specified, wherever it stands in for it.`,
        subjects: [component, implemented],
      });
    }
  }
  return found;
}

/** The Specification of a system context, with the Requirements of the profile it is verified against, if any. */
export function specify(context: SystemContext, profile?: Profile): Specification {
  const graph = context.design;
  const [system] = graph.ofEntity("System");
  if (system === undefined) throw new Error("the design has no System");
  const [root] = graph.navigate(system, "root");
  const packages = graph.navigate(system, "packages");
  const sections: Section[] = [
    ...(root === undefined ? [] : [component(graph, root)]),
    ...(packages.length === 0 ? [] : [{ id: "packages", title: "Packages", statements: [], sections: packages.map((c) => component(graph, c)) }]),
  ];
  const requirements = (profile?.rules ?? []).map((rule) => ({ id: `R:${rule.name}`, rule: rule.name, severity: rule.severity, about: rule.about, script: rule.script }));
  return { system: name(graph, system), sections, requirements, obligations: obligations(graph) };
}
