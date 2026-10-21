/**
 * Configurations: how a System is put together to run, and what it is checked against. It is
 * a metadata provider, as Documentation is: the core knows nothing of it, and nothing in a
 * design depends on it. A Configuration is about the System: from its root, it chooses for
 * each occupant of an Instance the Deployment of its box it runs — or none, leaving it an
 * interface — and names its profile, the rules it is verified against. An Instance of range
 * `0..N` has as many Choices as it has occupants. One Configuration is **current**: the one
 * the verifier verifies. They are kept with the System, as this provider's own attachment.
 *
 * Changing a Configuration is an Edit like any other: on the one History, told to every
 * session, and undone with the rest, because its Effect knows how to revert itself. What it
 * chooses goes with the design: a Choice for an Instance no longer there goes, with what was
 * chosen below it, and one of a Deployment no longer there chooses none. Both are kept until
 * the System is saved, so undoing the removal brings them back.
 */
import { boundOf, identityPath, nameOf, resolve, type Graph } from "@systemathic/core";
import type { Effect, Edit, EditSession } from "@systemathic/editing";
import { ArgumentError, type Operation } from "@systemathic/editors";
import type { MetadataProvider, SystemContext } from "@systemathic/tool";

/** Who the attachment the Configurations are kept in belongs to. */
export const ATTACHMENT_OWNER = "configurations";

/** One occupant's Choice: the Deployment of its box it runs (none: an interface), and the Choices below. */
export interface Choice {
  readonly id: string;
  /** The Instance it is an occupant of; null for the root Choice, which is for the System's root. */
  readonly instance: string | null;
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
  /** The id of the current Configuration; the first, if none is named. */
  readonly current?: string;
}

function stored(context: SystemContext): Partial<Stored> | undefined {
  return context.attachments.find((attachment) => attachment.owner === ATTACHMENT_OWNER)?.data as Partial<Stored> | undefined;
}

/** Every Configuration kept, with Choices of what is no longer in the design, so undoing a removal brings them back. */
function kept(data: Partial<Stored> | undefined): readonly Configuration[] {
  return Array.isArray(data?.configurations) ? data.configurations : [];
}

/** A Configuration as it is about `design`: without what was chosen for what is no longer there. */
function present(design: Graph, configuration: Configuration): Configuration {
  const there = (id: string | null) => id === null || design.has(id);
  const prune = (choice: Choice): Choice => ({
    ...choice,
    deployment: there(choice.deployment) ? choice.deployment : null,
    choices: choice.choices.filter((child) => there(child.instance)).map(prune),
  });
  return { ...configuration, root: prune(configuration.root) };
}

/** The Configurations kept with the System. */
export function configurations(context: SystemContext): readonly Configuration[] {
  return kept(stored(context)).map((c) => present(context.design, c));
}

/**
 * Configurations as a Metadata Provider. They are kept in its attachment, so there is nothing to
 * load; what it saves leaves out the Choices of what is no longer in the design, kept only so
 * undo can bring them back.
 */
export const configurationsProvider: MetadataProvider = {
  async load() {},
  async save(system) {
    const data = stored(system);
    if (!Array.isArray(data?.configurations)) return;
    const present = configurations(system);
    for (const attachment of system.attachments.filter((a) => a.owner === ATTACHMENT_OWNER)) system.detach(attachment);
    system.attach({ owner: ATTACHMENT_OWNER, data: { ...data, configurations: present } });
  },
};

/** The Configuration with this id, if there is one. */
export function configuration(context: SystemContext, id: string): Configuration | undefined {
  return configurations(context).find((c) => c.id === id);
}

/** The current Configuration: the one the verifier verifies — the one named current, or the first. */
export function current(context: SystemContext): Configuration | undefined {
  const all = configurations(context);
  const named = stored(context)?.current;
  return all.find((c) => c.id === named) ?? all[0];
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

/** Replaces every Configuration, and which is current; the Effect says how to put back what was there. */
function write(context: SystemContext, next: readonly Configuration[], touched: readonly string[], currentId: string | undefined): Effect {
  const before = kept(stored(context));
  const beforeCurrent = stored(context)?.current;
  for (const attachment of context.attachments.filter((a) => a.owner === ATTACHMENT_OWNER)) context.detach(attachment);
  const keep = currentId !== undefined && next.some((c) => c.id === currentId) ? currentId : undefined;
  if (next.length > 0) context.attach({ owner: ATTACHMENT_OWNER, data: (keep === undefined ? { configurations: next } : { configurations: next, current: keep }) satisfies Stored });
  return { touched, revert: () => write(context, before, touched, beforeCurrent) };
}

/** Every Configuration kept, with `change` applied to the one with this id. */
function changed(context: SystemContext, id: string, change: (c: Configuration) => Configuration | undefined): Configuration[] {
  if (configuration(context, id) === undefined) throw new ArgumentError(`there is no Configuration ${id}`);
  return kept(stored(context)).flatMap((c) => (c.id === id ? [change(c)].filter((x): x is Configuration => x !== undefined) : [c]));
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
  for (const c of kept(stored(context))) {
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
  const configuration: Configuration = { id, name, rules: [], root: { id: `${id}#root`, instance: null, deployment: deployment ?? null, choices: [] } };
  return session.record("addition", `addConfiguration ${name}`, [id], () => write(context, [...kept(stored(context)), configuration], [root], stored(context)?.current));
}

export function renameConfiguration(session: EditSession, id: string, name: string): Edit {
  const context = session.target.context;
  return session.record("change", `rename Configuration ${name}`, [], () => write(context, changed(context, id, (c) => ({ ...c, name })), [], stored(context)?.current));
}

export function removeConfiguration(session: EditSession, id: string): Edit {
  const context = session.target.context;
  return session.record("removal", "remove Configuration", [], () => write(context, changed(context, id, () => undefined), [], stored(context)?.current));
}

/** Makes a Configuration the current one: the one the verifier verifies. */
export function setCurrent(session: EditSession, id: string): Edit {
  const context = session.target.context;
  if (configuration(context, id) === undefined) throw new ArgumentError(`there is no Configuration ${id}`);
  return session.record("change", "setCurrent", [], () => write(context, kept(stored(context)), [], id));
}

/** Sets a Configuration's profile: the rules, by name, it is verified against. */
export function setRules(session: EditSession, id: string, rules: readonly string[]): Edit {
  const context = session.target.context;
  return session.record("change", "setRules", [], () => write(context, changed(context, id, (c) => ({ ...c, rules: [...rules] })), [], stored(context)?.current));
}

/**
 * Chooses for one more occupant of `instance`, below the Choice `parent`: the Deployment of its
 * box it runs, or none, leaving it an interface. Whether the choice fits is diagnosed, not
 * refused (see `problems`).
 */
export function choose(session: EditSession, parent: string, instance: string, deployment?: string): Edit {
  const context = session.target.context;
  const found = findChoice(context, parent);
  if (found === undefined) throw new ArgumentError(`there is no Choice ${parent}`);
  const id = fresh(context, `${parent}.${nameOf(context.design, instance) ?? "choice"}`);
  const choice: Choice = { id, instance, deployment: deployment ?? null, choices: [] };
  const next = changed(context, found.configuration.id, (c) => ({ ...c, root: changedChoice(c.root, parent, (p) => ({ ...p, choices: [...p.choices, choice] }))! }));
  return session.record("addition", "choose", [instance], () => write(context, next, [instance], stored(context)?.current));
}

/**
 * Changes the Deployment a Choice's occupant runs, or makes it none. What was chosen below it
 * goes when the Deployment changes, since it was for another Deployment's placements.
 */
export function changeChoice(session: EditSession, id: string, deployment?: string): Edit {
  const context = session.target.context;
  const found = findChoice(context, id);
  if (found === undefined) throw new ArgumentError(`there is no Choice ${id}`);
  const next = changed(context, found.configuration.id, (c) => ({
    ...c,
    root: changedChoice(c.root, id, (choice) => {
      const same = choice.deployment === (deployment ?? null);
      return { ...choice, deployment: deployment ?? null, choices: same ? choice.choices : [] };
    })!,
  }));
  const touched = deployment === undefined ? [] : [deployment];
  return session.record("change", "changeChoice", touched, () => write(context, next, touched, stored(context)?.current));
}

/** Removes a Choice, and what was chosen below it. The root Choice stays: remove the Configuration instead. */
export function unchoose(session: EditSession, id: string): Edit {
  const context = session.target.context;
  const found = findChoice(context, id);
  if (found === undefined) throw new ArgumentError(`there is no Choice ${id}`);
  if (found.choice.instance === null) throw new ArgumentError("the root Choice is the Configuration's own; remove the Configuration instead");
  const next = changed(context, found.configuration.id, (c) => ({ ...c, root: changedChoice(c.root, id, () => undefined)! }));
  return session.record("removal", "unchoose", [], () => write(context, next, [], stored(context)?.current));
}

/** One real Instance under a Configuration: the placement it occupies (none for the root), the Deployment it runs, and its path. */
export interface Occupant {
  readonly instance: string | null;
  readonly deployment: string | null;
  /** Its identity: the placements from the root down to it. */
  readonly path: readonly string[];
  /** The Choice that chose it, if one did. */
  readonly choice?: Choice;
}

/**
 * Every real Instance under a Configuration, from the root down. A placement it makes no Choice
 * for is one occupant, running the Deployment the design fixes (`runs`), if any.
 */
export function occupants(graph: Graph, configuration: Configuration): Occupant[] {
  const found: Occupant[] = [];
  const isDeployment = (id: string | null) => id !== null && graph.has(id) && graph.get(id).entity === "Deployment";
  const walk = (occupant: Occupant, choices: readonly Choice[]) => {
    found.push(occupant);
    if (!isDeployment(occupant.deployment)) return;
    for (const placement of graph.navigate(occupant.deployment!, "instances")) {
      const fixed = graph.navigate(placement, "runs")[0] ?? null;
      const mine = choices.filter((c) => c.instance === placement);
      if (mine.length === 0) walk({ instance: placement, deployment: fixed, path: [...occupant.path, placement] }, []);
      for (const choice of mine) walk({ instance: placement, deployment: choice.deployment ?? fixed, path: [...occupant.path, placement], choice }, choice.choices);
    }
  };
  walk({ instance: null, deployment: configuration.root.deployment, path: [], choice: configuration.root }, configuration.root.choices);
  return found;
}

/** What a Configuration check found: which check (C1–C4), what about, and why. */
export interface Problem {
  readonly configuration: string;
  readonly choice: string | null;
  /** `C1` a Choice's Deployment, `C2` a range, `C3` an identity, `C4` a need. */
  readonly check: "C1" | "C2" | "C3" | "C4";
  readonly message: string;
  /** Ids in the design the problem is about. */
  readonly subjects: readonly string[];
}

/**
 * Where a Configuration does not fit the design (docs/foundation.md, *What is verified*):
 * - C1: every Choice is of a Deployment of its occupant's box — the root's for the root Choice —
 *   for a placement of the Deployment chosen above, and agrees with what the placement runs, if fixed;
 * - C2: no Instance has more occupants chosen than its range;
 * - C3: every identity a chosen Deployment imports exists: its path is the path of an occupant;
 * - C4: every need of a chosen Deployment is present: some occupant runs each Deployment it
 *   imports, and some occupant offers each Interaction it imports. Which occupant, or where, is
 *   not asked: only that one exists.
 */
export function problems(context: SystemContext): Problem[] {
  const graph = context.design;
  const found: Problem[] = [];
  const has = (id: string | null, entity: string) => id !== null && graph.has(id) && graph.get(id).entity === entity;
  for (const configuration of configurations(context)) {
    const report = (check: Problem["check"], choice: Choice | undefined, message: string, ...subjects: (string | null | undefined)[]) =>
      found.push({
        configuration: configuration.id,
        choice: choice?.id ?? null,
        check,
        message: `${configuration.name}: ${message}`,
        subjects: subjects.filter((s): s is string => typeof s === "string" && graph.has(s)),
      });
    const check = (choice: Choice, above: Choice | undefined, aboveDeployment: string | null) => {
      const box = choice.instance === null ? context.root : graph.has(choice.instance) ? graph.navigate(choice.instance, "of")[0] : undefined;
      if (choice.deployment !== null) {
        if (!has(choice.deployment, "Deployment")) report("C1", choice, `${choice.deployment} is not a Deployment of the System`);
        else if (graph.navigate(choice.deployment, "component")[0] !== box) {
          report("C1", choice, `${name(graph, choice.deployment)} is not a Deployment of ${name(graph, box ?? null)}`, choice.deployment, choice.instance);
        }
      }
      if (above === undefined) {
        if (choice.instance !== null) report("C1", choice, "the root Choice is for the System's root, not for an Instance", choice.instance);
      } else if (!has(choice.instance, "Instance") || graph.navigate(choice.instance!, "deployment")[0] !== aboveDeployment) {
        report("C1", choice, `${name(graph, choice.instance)} is not a placement of the Deployment chosen above`, choice.instance);
      } else {
        const fixed = graph.navigate(choice.instance!, "runs")[0];
        if (fixed !== undefined && choice.deployment !== null && choice.deployment !== fixed) {
          report("C1", choice, `${name(graph, choice.instance)} runs ${name(graph, fixed)}, fixed, not ${name(graph, choice.deployment)}`, choice.instance, choice.deployment);
        }
      }
      const running = choice.deployment ?? (choice.instance !== null && graph.has(choice.instance) ? (graph.navigate(choice.instance, "runs")[0] ?? null) : null);
      const counts = new Map<string, number>();
      for (const child of choice.choices) if (child.instance !== null) counts.set(child.instance, (counts.get(child.instance) ?? 0) + 1);
      for (const [instance, count] of counts) {
        const max = graph.has(instance) ? boundOf(graph, instance, "max") : undefined;
        if (max !== undefined && count > max) report("C2", choice, `${name(graph, instance)} has ${count} occupants chosen, but at most ${max}`, instance);
      }
      for (const child of choice.choices) check(child, choice, running);
    };
    check(configuration.root, undefined, null);

    const real = occupants(graph, configuration);
    const paths = new Set(real.map((o) => o.path.join("/")));
    const running = new Set(real.map((o) => o.deployment).filter((d): d is string => d !== null));
    const offering = new Set<string>();
    for (const o of real) {
      const box = o.instance === null ? context.root : graph.navigate(o.instance, "of")[0];
      if (box === undefined) continue;
      offering.add(box);
      for (const e of graph.navigate(box, "exports")) for (const api of graph.navigate(e, "component")) offering.add(api);
    }
    for (const o of real) {
      if (!has(o.deployment, "Deployment")) continue;
      for (const m of graph.navigate(o.deployment!, "imports")) {
        if (graph.navigate(m, "steps").length > 0) {
          const path = identityPath(graph, m);
          if (!paths.has(path.join("/"))) {
            report("C3", o.choice, `${name(graph, o.deployment)} imports /${path.map((p) => name(graph, p)).join("/")}, which does not exist here`, o.deployment, m);
          }
          continue;
        }
        for (const e of graph.navigate(m, "exports")) {
          const target = resolve(graph, e);
          if (target === undefined) continue;
          const entity = graph.get(target).entity;
          if (entity === "Deployment" && !running.has(target)) report("C4", o.choice, `${name(graph, o.deployment)} needs ${name(graph, target)}, which no occupant runs`, o.deployment, target);
          if (entity === "Interaction") {
            const owner = graph.navigate(target, "component")[0];
            if (owner !== undefined && !offering.has(owner)) report("C4", o.choice, `${name(graph, o.deployment)} needs ${name(graph, target)}, which no occupant offers`, o.deployment, target);
          }
        }
      }
    }
  }
  return found;
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
    about: "Chooses for one more occupant of an Instance, below a Choice: the Deployment of its box it runs, or none, leaving it an interface.",
    parameters: [
      { name: "parent", kind: "text", about: "the id of the Choice above: one for the Deployment the Instance is in" },
      { name: "instance", kind: "element", of: ["Instance"], about: "the Instance" },
      { name: "deployment", kind: "element", of: ["Deployment"], about: "the Deployment of its box it runs", optional: true },
    ],
    run: (session, args) => choose(session, text(args, "parent")!, text(args, "instance")!, text(args, "deployment", true)),
  },
  {
    editor: "ConfigurationEditor",
    name: "changeChoice",
    kind: "change",
    about: "Changes the Deployment a Choice's occupant runs, or makes it none; what was chosen below goes if the Deployment changes.",
    parameters: [
      { name: "choice", kind: "text", about: "the id of the Choice" },
      { name: "deployment", kind: "element", of: ["Deployment"], about: "the Deployment it runs", optional: true },
    ],
    run: (session, args) => changeChoice(session, text(args, "choice")!, text(args, "deployment", true)),
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
    name: "setCurrent",
    kind: "change",
    about: "Makes a Configuration the current one: the one the verifier verifies.",
    parameters: [{ name: "configuration", kind: "text", about: "the id of the Configuration" }],
    run: (session, args) => setCurrent(session, text(args, "configuration")!),
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
