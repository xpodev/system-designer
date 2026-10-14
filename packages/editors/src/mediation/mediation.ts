/**
 * MediationEditor (Mediation): a Connection's stack of Mediations — each over a Medium, and
 * optionally realized by a round trip of Transformations. The top one mediates the Connection's
 * What; each one below, the call of the Medium above it.
 */
import { mediationStack, nameOf, parameters, remove as removeFromModel, setMediationStack, setName, setParameters, type Graph } from "@systemathic/core";
import type { Edit, EditSession } from "@systemathic/editing";
import { addNamed, element, freshId, index, maybe, operation, str, text, type Operation } from "../operation.js";
import { reach } from "../contexts/exports.js";

const EDITOR = "MediationEditor";

/** Adds a Mediation over a Medium to a Connection's stack, at `position` or at the bottom. */
export function addMediation(session: EditSession, connection: string, medium: string, position?: number): Edit {
  const id = freshId(session.target.graph, connection, "mediation");
  return session.edit("addition", "addMediation", [id], (graph) => {
    graph.add("Mediation", id);
    graph.connect(id, "how", medium);
    const stack = mediationStack(graph, connection);
    stack.splice(position ?? stack.length, 0, id);
    setMediationStack(graph, connection, stack);
  });
}

export function setHow(session: EditSession, mediation: string, medium: string): Edit {
  return session.edit("change", "setHow", [mediation], (graph) => {
    graph.disconnect(mediation, "how");
    graph.connect(mediation, "how", medium);
  });
}

/** Realizes a Mediation with existing Transformations, or, without them, leaves it unrealized. */
export function realize(session: EditSession, mediation: string, down: string | undefined, up: string | undefined): Edit {
  return session.edit("change", "realize", [mediation], (graph) => {
    graph.disconnect(mediation, "down");
    graph.disconnect(mediation, "up");
    if (down !== undefined) graph.connect(mediation, "down", down);
    if (up !== undefined) graph.connect(mediation, "up", up);
  });
}

/** The Interaction a Mediation mediates: the Connection's first What, or the call of the Medium above it. */
export function whatInteraction(graph: Graph, mediation: string): string | undefined {
  const [connection] = graph.navigate(mediation, "connection");
  if (connection === undefined) return undefined;
  const stack = mediationStack(graph, connection);
  const position = stack.indexOf(mediation);
  if (position <= 0) return graph.navigate(connection, "what")[0];
  const [above] = graph.navigate(stack[position - 1]!, "how");
  return above === undefined ? undefined : graph.navigate(above, "call")[0];
}

/** The Language a Mediation's What is over: the Connection's What's, or the call's of the Medium above it. */
export function whatLanguage(graph: Graph, mediation: string): string | undefined {
  const interaction = whatInteraction(graph, mediation);
  return interaction === undefined ? undefined : graph.navigate(interaction, "language")[0];
}

/** The input and output Entities of an Interaction: its first Parameter's type, and its output. */
function signature(graph: Graph, interaction: string | undefined): { input?: string; output?: string } {
  if (interaction === undefined) return {};
  const [first] = parameters(graph, interaction);
  return { input: first === undefined ? undefined : graph.navigate(first, "type")[0], output: graph.navigate(interaction, "output")[0] };
}

/**
 * Creates a Mediation's realization: `down` and `up` between its What's Language and its
 * Medium's, in a Component of their own beside the Connection's ends — which both import them
 * — so the ends' own Components stay clean. A Connection to the deployed Component itself is
 * realized in that Component, which both ends reach directly.
 */
export function createRealization(session: EditSession, mediation: string, name?: string): Edit {
  const graph = session.target.graph;
  const what = whatLanguage(graph, mediation);
  const [medium] = graph.navigate(mediation, "how");
  const how = medium === undefined ? undefined : graph.navigate(medium, "language")[0];
  const [connection] = graph.navigate(mediation, "connection");
  if (what === undefined || how === undefined || connection === undefined) {
    throw new Error("a Mediation is realized between its What's Language and its Medium's: it has to have both");
  }
  const [deployment] = graph.navigate(connection, "deployment");
  const [deployed] = deployment === undefined ? [] : graph.navigate(deployment, "component");
  if (deployed === undefined) throw new Error("the Connection is in no Deployment");
  const [toComponent] = graph.navigate(connection, "toComponent");
  const title = name ?? `${nameOf(graph, what) ?? "What"}Over${nameOf(graph, how) ?? "How"}`;
  const holder = toComponent ?? freshId(graph, deployed, title);
  const down = freshId(graph, holder, `${title} down`);
  const up = freshId(graph, holder, `${title} up`);
  return session.edit("addition", `createRealization ${title}`, [holder, down, up], (graph) => {
    if (toComponent === undefined) addNamed(graph, "Component", holder, title, deployed, "components");
    for (const language of [what, how]) {
      graph.connect(holder, "uses", language);
      reach(graph, holder, language);
    }
    // The way down takes what the What takes, and gives what the call takes; the way up takes
    // what the call gives, and gives what the What gives. Where either is unknown, the
    // signature is left for the designer, and diagnosed.
    const above = signature(graph, whatInteraction(graph, mediation));
    const call = signature(graph, graph.navigate(medium!, "call")[0]);
    const realize = (id: string, title: string, input: string | undefined, output: string | undefined) => {
      addNamed(graph, "Transformation", id, title, holder, "transformations");
      if (input !== undefined) {
        const parameter = `${id}.input`;
        graph.add("Parameter", parameter);
        setName(graph, parameter, "input");
        graph.connect(parameter, "type", input);
        setParameters(graph, id, [parameter]);
      }
      if (output !== undefined) graph.connect(id, "output", output);
    };
    realize(down, `${title} down`, above.input, call.input);
    realize(up, `${title} up`, call.output, above.output);
    graph.disconnect(mediation, "down");
    graph.disconnect(mediation, "up");
    graph.connect(mediation, "down", down);
    graph.connect(mediation, "up", up);
    if (toComponent !== undefined) return;
    const ends = [...graph.navigate(connection, "from"), ...graph.navigate(connection, "to")].flatMap((instance) => graph.navigate(instance, "of"));
    for (const end of ends) for (const transformation of [down, up]) reach(graph, end, transformation);
  });
}

/** Moves a Mediation to `position` in its stack. */
export function move(session: EditSession, mediation: string, position: number): Edit {
  return session.edit("change", "moveMediation", [mediation], (graph) => {
    const [connection] = graph.navigate(mediation, "connection");
    if (connection === undefined) return;
    const stack = mediationStack(graph, connection).filter((id) => id !== mediation);
    stack.splice(position, 0, mediation);
    setMediationStack(graph, connection, stack);
  });
}

/** Removes a Mediation from its stack; the ones below it close up. */
export function remove(session: EditSession, mediation: string): Edit {
  return session.edit("removal", "removeMediation", [mediation], (graph) => {
    const [connection] = graph.navigate(mediation, "connection");
    const rest = connection === undefined ? [] : mediationStack(graph, connection).filter((id) => id !== mediation);
    removeFromModel(graph, mediation);
    if (connection !== undefined) setMediationStack(graph, connection, rest);
  });
}

const MEDIATION = element("mediation", "Mediation", "the Mediation");

export const mediationEditor: readonly Operation[] = [
  operation(
    EDITOR,
    "addMediation",
    "addition",
    "Adds a Mediation over a Medium to a Connection's stack, at a position or at the bottom.",
    [element("connection", "Connection", "the Connection"), element("medium", "Medium", "the Medium"), index("position", "where in the stack, from 0", true)],
    (s, a) => addMediation(s, str(a, "connection"), str(a, "medium"), a.position as number | undefined),
  ),
  operation(EDITOR, "setHow", "change", "Sets the Medium a Mediation is over.", [MEDIATION, element("medium", "Medium", "the Medium")], (s, a) =>
    setHow(s, str(a, "mediation"), str(a, "medium")),
  ),
  operation(
    EDITOR,
    "realize",
    "change",
    "Realizes a Mediation with existing Transformations down into its Medium's Language and up from it; without them, leaves it unrealized.",
    [MEDIATION, element("down", "Transformation", "the way down", true), element("up", "Transformation", "the way up", true)],
    (s, a) => realize(s, str(a, "mediation"), maybe(a, "down"), maybe(a, "up")),
  ),
  operation(
    EDITOR,
    "createRealization",
    "addition",
    "Creates a Mediation's realization: a Component beside the Connection's ends holding the way down and the way up, imported by both ends.",
    [MEDIATION, text("name", "the realization's name", true)],
    (s, a) => createRealization(s, str(a, "mediation"), maybe(a, "name")),
  ),
  operation(EDITOR, "move", "change", "Moves a Mediation within its stack.", [MEDIATION, index("position", "where in the stack, from 0")], (s, a) =>
    move(s, str(a, "mediation"), a.position as number),
  ),
  operation(EDITOR, "remove", "removal", "Removes a Mediation from its stack.", [MEDIATION], (s, a) => remove(s, str(a, "mediation"))),
];
