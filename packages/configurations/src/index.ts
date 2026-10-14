/**
 * Configurations: how a System is put together to run, and what it is checked against. It is
 * a metadata provider, as Documentation is: the core knows nothing of it, and nothing in a
 * design depends on it. A Configuration is about the System: from its root, it chooses for
 * each occupant of an Instance the Component that fills it — the Instance's own Component, or
 * one implementing it — and which of that Component's Deployments it runs as; and it names its
 * profile, the rules it is verified against. An Instance of range `0..N` has as many Choices
 * as it has occupants. They are kept with the System, as this provider's own attachment.
 *
 * Changing a Configuration is an Edit like any other: on the one History, told to every
 * session, and undone with the rest, because its Effect knows how to revert itself.
 */
import { boundOf, nameOf, type Graph } from "@systemathic/core";
import type { Effect, Edit, EditSession } from "@systemathic/editing";
import { ArgumentError, type Operation } from "@systemathic/editors";
import type { SystemContext } from "@systemathic/tool";

/** Who the attachment the Configurations are kept in belongs to. */
export const ATTACHMENT_OWNER = "configurations";

/** One occupant's Choice: the Component that fills it, the Deployment it runs as (none for one without), and the Choices below. */
export interface Choice {
  readonly id: string;
  /** The Instance it is an occupant of; null for the root Choice, which is for the System's root. */
  readonly instance: string | null;
  readonly component: string;
  readonly deployment: string | null;
  readonly choices: readonly Choice[];
}

export interface Configuration {
  readonly id: string;
  readonly name: string;
  /** The profile: the names of the rules it is verified against. */
  readonly rules: readonly string[];
  readonly root: Choice;
}

interface Stored {
  readonly configurations: readonly Configuration[];
}

/** The Configurations kept with the System, as they are stored. */
export function configurations(context: SystemContext): readonly Configuration[] {
  const data = context.attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<Stored> | undefined;
  return Array.isArray(data?.configurations) ? data.configurations : [];
}

/** The Configuration with this id, if there is one. */
export function configuration(context: SystemContext, id: string): Configuration | undefined {
  return configurations(context).find((c) => c.id === id);
}

/** The Choice with this id, anywhere, with the Configuration it is in. */
export function findChoice(context: SystemContext, id: string): { configuration: Configuration; choice: Choice } | undefined {
  const search = (choice: Choice): Choice | undefined => (choice.id === id ? choice : choice.choices.map(search).find((found) => found !== undefined));
  for (const c of configurations(context)) {
    const choice = search(c.root);
    if (choice !== undefined) return { configuration: c, choice };
  }
  return undefined;
}

/** Replaces every Configuration; the Effect says how to put back what was there. */
function write(context: SystemContext, next: readonly Configuration[], touched: readonly string[]): Effect {
  const before = configurations(context);
  for (const attachment of context.attachments.filter((a) => a.owner === ATTACHMENT_OWNER)) context.detach(attachment);
  if (next.length > 0) context.attach({ owner: ATTACHMENT_OWNER, data: { configurations: next } satisfies Stored });
  return { touched, revert: () => write(context, before, touched) };
}

/** Every Configuration, with `change` applied to the one with this id. */
function changed(context: SystemContext, id: string, change: (c: Configuration) => Configuration | undefined): Configuration[] {
  if (configuration(context, id) === undefined) throw new ArgumentError(`there is no Configuration ${id}`);
  return configurations(context).flatMap((c) => (c.id === id ? [change(c)].filter((x): x is Configuration => x !== undefined) : [c]));
}

/** The Choice tree with `change` applied to the Choice with this id; `undefined` removes it. */
function changedChoice(choice: Choice, id: string, change: (choice: Choice) => Choice | undefined): Choice | undefined {
  if (choice.id === id) return change(choice);
  return { ...choice, choices: choice.choices.map((child) => changedChoice(child, id, change)).filter((x): x is Choice => x !== undefined) };
}

/** Every id in use, so a new one never clashes. */
function fresh(context: SystemContext, base: string): string {
  const used = new Set<string>();
  const collect = (choice: Choice) => {
    used.add(choice.id);
    choice.choices.forEach(collect);
  };
  for (const c of configurations(context)) {
    used.add(c.id);
    collect(c.root);
  }
  let id = base;
  for (let n = 2; used.has(id) || context.design.has(id); n++) id = `${base}-${n}`;
  return id;
}

const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "configuration";

/** Adds a Configuration whose root Choice runs the System's root as `deployment`, or as none. */
export function addConfiguration(session: EditSession, name: string, deployment?: string): Edit {
  const context = session.target.context;
  const root = context.root;
  if (root === undefined) throw new ArgumentError("the System has no root to configure");
  const id = fresh(context, `${context.system ?? "system"}.${slug(name)}`);
  const configuration: Configuration = { id, name, rules: [], root: { id: `${id}#root`, instance: null, component: root, deployment: deployment ?? null, choices: [] } };
  return session.record("addition", `addConfiguration ${name}`, [id], () => write(context, [...configurations(context), configuration], [root]));
}

export function renameConfiguration(session: EditSession, id: string, name: string): Edit {
  const context = session.target.context;
  return session.record("change", `rename Configuration ${name}`, [], () => write(context, changed(context, id, (c) => ({ ...c, name })), []));
}

export function removeConfiguration(session: EditSession, id: string): Edit {
  const context = session.target.context;
  return session.record("removal", "remove Configuration", [], () => write(context, changed(context, id, () => undefined), []));
}

/** Sets a Configuration's profile: the rules, by name, it is verified against. */
export function setRules(session: EditSession, id: string, rules: readonly string[]): Edit {
  const context = session.target.context;
  return session.record("change", "setRules", [], () => write(context, changed(context, id, (c) => ({ ...c, rules: [...rules] })), []));
}

/**
 * Chooses for one more occupant of `instance`, below the Choice `parent`: the Component that
 * fills it, and the Deployment it runs as, or none. Whether the choice fits is diagnosed, not
 * refused (see `problems`).
 */
export function choose(session: EditSession, parent: string, instance: string, component: string, deployment?: string): Edit {
  const context = session.target.context;
  const found = findChoice(context, parent);
  if (found === undefined) throw new ArgumentError(`there is no Choice ${parent}`);
  const id = fresh(context, `${parent}.${nameOf(context.design, instance) ?? "choice"}`);
  const choice: Choice = { id, instance, component, deployment: deployment ?? null, choices: [] };
  const next = changed(context, found.configuration.id, (c) => ({ ...c, root: changedChoice(c.root, parent, (p) => ({ ...p, choices: [...p.choices, choice] }))! }));
  return session.record("addition", "choose", [instance, component], () => write(context, next, [instance, component]));
}

/**
 * Changes what fills a Choice's occupant, and the Deployment it runs as. What was chosen below
 * it goes when the Deployment changes, since it was for another Deployment's Instances.
 */
export function changeChoice(session: EditSession, id: string, component: string, deployment?: string): Edit {
  const context = session.target.context;
  const found = findChoice(context, id);
  if (found === undefined) throw new ArgumentError(`there is no Choice ${id}`);
  const next = changed(context, found.configuration.id, (c) => ({
    ...c,
    root: changedChoice(c.root, id, (choice) => {
      const same = choice.deployment === (deployment ?? null);
      return { ...choice, component, deployment: deployment ?? null, choices: same ? choice.choices : [] };
    })!,
  }));
  return session.record("change", "changeChoice", [component], () => write(context, next, [component]));
}

/** Removes a Choice, and what was chosen below it. The root Choice stays: remove the Configuration instead. */
export function unchoose(session: EditSession, id: string): Edit {
  const context = session.target.context;
  const found = findChoice(context, id);
  if (found === undefined) throw new ArgumentError(`there is no Choice ${id}`);
  if (found.choice.instance === null) throw new ArgumentError("the root Choice is the Configuration's own; remove the Configuration instead");
  const next = changed(context, found.configuration.id, (c) => ({ ...c, root: changedChoice(c.root, id, () => undefined)! }));
  return session.record("removal", "unchoose", [], () => write(context, next, []));
}

export interface Problem {
  readonly configuration: string;
  readonly choice: string;
  readonly message: string;
}

/**
 * Where a Configuration does not fit the design, by the formulas of the Configurations
 * Language: a root Choice for the System's root, every other Choice for an Instance of the
 * Deployment chosen above it, filled by that Instance's Component or one implementing it, run
 * as one of that Component's Deployments — and no more occupants than the Instance's range.
 */
export function problems(context: SystemContext): Problem[] {
  const graph = context.design;
  const found: Problem[] = [];
  const has = (id: string | null, entity: string) => id !== null && graph.has(id) && graph.get(id).entity === entity;
  for (const configuration of configurations(context)) {
    const report = (choice: Choice, message: string) => found.push({ configuration: configuration.id, choice: choice.id, message });
    const check = (choice: Choice, above: Choice | undefined) => {
      if (!has(choice.component, "Component")) report(choice, `${choice.component} is not a Component of the System`);
      else if (choice.deployment !== null && !(has(choice.deployment, "Deployment") && graph.navigate(choice.deployment, "component")[0] === choice.component)) {
        report(choice, `${name(graph, choice.deployment)} is not a Deployment of ${name(graph, choice.component)}`);
      }
      if (above === undefined) {
        if (choice.instance !== null) report(choice, "the root Choice is for the System's root, not for an Instance");
        else if (choice.component !== context.root) report(choice, `the root Choice is for the System's root, not ${name(graph, choice.component)}`);
      } else if (!has(choice.instance, "Instance") || graph.navigate(choice.instance!, "deployment")[0] !== above.deployment) {
        report(choice, `${name(graph, choice.instance)} is not an Instance of the Deployment chosen above`);
      } else {
        const placed = graph.navigate(choice.instance!, "of")[0];
        if (placed !== undefined && choice.component !== placed && !implementing(graph, choice.component, placed)) {
          report(choice, `${name(graph, choice.component)} neither is ${name(graph, placed)} nor implements it`);
        }
      }
      const occupants = new Map<string, number>();
      for (const child of choice.choices) if (child.instance !== null) occupants.set(child.instance, (occupants.get(child.instance) ?? 0) + 1);
      for (const [instance, count] of occupants) {
        const max = graph.has(instance) ? boundOf(graph, instance, "max") : undefined;
        if (max !== undefined && count > max) report(choice, `${name(graph, instance)} has ${count} occupants chosen, but at most ${max}`);
      }
      for (const child of choice.choices) check(child, choice);
    };
    check(configuration.root, undefined);
  }
  return found;
}

/** `placed in component.^implements`. */
function implementing(graph: Graph, component: string, placed: string): boolean {
  const seen = new Set<string>();
  const pending = graph.has(component) ? graph.navigate(component, "implements") : [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === placed) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...graph.navigate(current, "implements"));
  }
  return false;
}

const name = (graph: Graph, id: string | null) => (id !== null && graph.has(id) ? (nameOf(graph, id) ?? id) : (id ?? "nothing"));

const text = (args: Readonly<Record<string, unknown>>, key: string, optional = false): string | undefined => {
  const value = args[key];
  if (value === undefined || value === null) {
    if (optional) return undefined;
    throw new ArgumentError(`${key}: expected text, got nothing`);
  }
  if (typeof value !== "string") throw new ArgumentError(`${key}: expected text, got ${JSON.stringify(value)}`);
  return value;
};

/** The ConfigurationEditor's operations, as data, for clients to be built from. Configurations and Choices are named by their ids. */
export const configurationEditor: readonly Operation[] = [
  {
    editor: "ConfigurationEditor",
    name: "addConfiguration",
    kind: "addition",
    about: "Adds a Configuration: one way to put the whole System together, starting from a Deployment of its root (or none).",
    parameters: [
      { name: "name", kind: "text", about: "the Configuration's name" },
      { name: "deployment", kind: "element", of: ["Deployment"], about: "a Deployment of the root", optional: true },
    ],
    run: (session, args) => addConfiguration(session, text(args, "name")!, text(args, "deployment", true)),
  },
  {
    editor: "ConfigurationEditor",
    name: "choose",
    kind: "addition",
    about: "Chooses for one more occupant of an Instance, below a Choice: the Component that fills it (the Instance's own, or one implementing it), and the Deployment it runs as, or none.",
    parameters: [
      { name: "parent", kind: "text", about: "the id of the Choice above: one for the Deployment the Instance is in" },
      { name: "instance", kind: "element", of: ["Instance"], about: "the Instance" },
      { name: "component", kind: "element", of: ["Component"], about: "the Component that fills it" },
      { name: "deployment", kind: "element", of: ["Deployment"], about: "the Deployment it runs as", optional: true },
    ],
    run: (session, args) => choose(session, text(args, "parent")!, text(args, "instance")!, text(args, "component")!, text(args, "deployment", true)),
  },
  {
    editor: "ConfigurationEditor",
    name: "changeChoice",
    kind: "change",
    about: "Changes the Component filling a Choice's occupant, and the Deployment it runs as; what was chosen below goes if the Deployment changes.",
    parameters: [
      { name: "choice", kind: "text", about: "the id of the Choice" },
      { name: "component", kind: "element", of: ["Component"], about: "the Component that fills it" },
      { name: "deployment", kind: "element", of: ["Deployment"], about: "the Deployment it runs as", optional: true },
    ],
    run: (session, args) => changeChoice(session, text(args, "choice")!, text(args, "component")!, text(args, "deployment", true)),
  },
  {
    editor: "ConfigurationEditor",
    name: "unchoose",
    kind: "removal",
    about: "Removes a Choice, and what was chosen below it.",
    parameters: [{ name: "choice", kind: "text", about: "the id of the Choice" }],
    run: (session, args) => unchoose(session, text(args, "choice")!),
  },
  {
    editor: "ConfigurationEditor",
    name: "setRules",
    kind: "change",
    about: "Sets a Configuration's profile: the rules, by name, it is verified against.",
    parameters: [
      { name: "configuration", kind: "text", about: "the id of the Configuration" },
      { name: "rules", kind: "text", about: "the rules' names, separated by commas" },
    ],
    run: (session, args) =>
      setRules(
        session,
        text(args, "configuration")!,
        text(args, "rules")!
          .split(",")
          .map((rule) => rule.trim())
          .filter((rule) => rule !== ""),
      ),
  },
  {
    editor: "ConfigurationEditor",
    name: "rename",
    kind: "change",
    about: "Renames a Configuration.",
    parameters: [
      { name: "configuration", kind: "text", about: "the id of the Configuration" },
      { name: "name", kind: "text", about: "the new name" },
    ],
    run: (session, args) => renameConfiguration(session, text(args, "configuration")!, text(args, "name")!),
  },
  {
    editor: "ConfigurationEditor",
    name: "remove",
    kind: "removal",
    about: "Removes a Configuration.",
    parameters: [{ name: "configuration", kind: "text", about: "the id of the Configuration" }],
    run: (session, args) => removeConfiguration(session, text(args, "configuration")!),
  },
];
