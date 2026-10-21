/**
 * DeploymentFormat: the Deployments a Component keeps, as JSON. A Deployment names the box it
 * lays out, `of`, and nests its named Instances — each with its range, and the Deployment it
 * `runs`, if fixed — its Connections, its Imports (its needs) and what it `exposes`: Exports of
 * its placements. A Connection refers to the Instance it goes from; to an Instance, an identity
 * the Deployment imports, or the box; and to the Interactions of its What. An identity is an
 * Import written as a `path` of placements, from the root down. An Export may name a kept
 * `deployment`. Layers above Deployment add their parts of a Connection through the hooks.
 */
import { identityPath, nameOf, setIdentitySteps, setName, type Graph } from "@systemathic/core";
import { readImports, writeImports, type Extension, type ImportJson } from "./contexts-format.js";
import { readRange, writeRange } from "./kernel-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface InstanceJson { id: string; name: string; of: string; runs: string | null; min: number; max: number | "N" }
export interface ConnectionJson { id: string; from: string; to: string | null; toComponent: string | null; toIdentity: string | null; what: string[] }
export interface ExposureJson { id: string; instance: string }
export interface DeploymentJson {
  id: string; name: string; of: string;
  instances: InstanceJson[]; connections: ConnectionJson[]; imports: ImportJson[]; exposes: ExposureJson[];
}

/** What a layer above Deployment reads into, and writes from, a Connection. */
export interface ConnectionExtension {
  readConnection(reader: Reader, connection: string, json: Record<string, unknown>, at: string): void;
  writeConnection(graph: Graph, connection: string): Record<string, unknown>;
}

/** The Deployment layer of a Component (`deployments`), of an Export (`deployment`), and of an Import (`path`). */
export function deployment(extensions: readonly ConnectionExtension[] = []): Extension {
  const self: Extension = {
    readComponent(reader, component, json, at) {
      array(json.deployments, `${at}.deployments`).forEach((value, index) => {
        readDeployment(reader, component, value, `${at}.deployments[${index}]`, extensions, self);
      });
    },
    writeComponent: (graph, component) => ({
      deployments: graph.navigate(component, "kept").map((id) => writeDeployment(graph, id, extensions, self)),
    }),
    readExport(reader, exported, json, at) {
      if (json.deployment !== undefined) reader.refer(exported, "deployment", json.deployment, `${at}.deployment`);
    },
    writeExport(graph, exported): Record<string, string> {
      const [kept] = graph.navigate(exported, "deployment");
      return kept === undefined ? {} : { deployment: kept };
    },
    readImport(reader, imported, json, at) {
      if (json.path === undefined) return false;
      const steps = array(json.path, `${at}.path`).map((ref, i) => {
        const step = `${imported}#${i}`;
        reader.graph.add("Step", step);
        reader.refer(step, "instance", ref, `${at}.path[${i}]`);
        return step;
      });
      setIdentitySteps(reader.graph, imported, steps);
      return true;
    },
    writeImport(graph, imported) {
      return graph.navigate(imported, "steps").length === 0 ? undefined : { id: imported, path: identityPath(graph, imported) };
    },
  };
  return self;
}

function readDeployment(reader: Reader, keeper: string, value: unknown, at: string, extensions: readonly ConnectionExtension[], layer: Extension): void {
  const graph = reader.graph;
  const json = object(value, at);
  const id = reader.create("Deployment", json.id, at);
  if (id === undefined) return;
  setName(graph, id, string(json.name, `${at}.name`));
  graph.connect(keeper, "kept", id);
  reader.refer(id, "component", json.of ?? keeper, `${at}.of`);
  array(json.instances, `${at}.instances`).forEach((value, index) => {
    const where = `${at}.instances[${index}]`;
    const instance = object(value, where);
    const instanceId = reader.create("Instance", instance.id, where);
    if (instanceId === undefined) return;
    setName(graph, instanceId, string(instance.name, `${where}.name`));
    graph.connect(id, "instances", instanceId);
    reader.refer(instanceId, "of", instance.of, `${where}.of`);
    if (instance.runs !== undefined && instance.runs !== null) reader.refer(instanceId, "runs", instance.runs, `${where}.runs`);
    readRange(reader, instanceId, instance, where);
  });
  readImports(reader, id, json.imports ?? [], `${at}.imports`, [layer]);
  array(json.exposes ?? [], `${at}.exposes`).forEach((value, index) => {
    const where = `${at}.exposes[${index}]`;
    const exposed = object(value, where);
    const exportId = reader.create("Export", exposed.id, where);
    if (exportId === undefined) return;
    graph.connect(id, "exposes", exportId);
    reader.refer(exportId, "instance", exposed.instance, `${where}.instance`);
  });
  array(json.connections, `${at}.connections`).forEach((value, index) => {
    const where = `${at}.connections[${index}]`;
    const connection = object(value, where);
    const connectionId = reader.create("Connection", connection.id, where);
    if (connectionId === undefined) return;
    graph.connect(id, "connections", connectionId);
    reader.refer(connectionId, "from", connection.from, `${where}.from`);
    if (connection.to !== null && connection.to !== undefined) reader.refer(connectionId, "to", connection.to, `${where}.to`);
    if (connection.toComponent !== null && connection.toComponent !== undefined) reader.refer(connectionId, "toComponent", connection.toComponent, `${where}.toComponent`);
    if (connection.toIdentity !== null && connection.toIdentity !== undefined) reader.refer(connectionId, "toIdentity", connection.toIdentity, `${where}.toIdentity`);
    array(connection.what, `${where}.what`).forEach((ref, i) => reader.refer(connectionId, "what", ref, `${where}.what[${i}]`));
    for (const extension of extensions) extension.readConnection(reader, connectionId, connection, where);
  });
}

function writeDeployment(graph: Graph, deployment: string, extensions: readonly ConnectionExtension[], layer: Extension): DeploymentJson {
  return {
    id: deployment,
    name: nameOf(graph, deployment) ?? "",
    of: graph.navigate(deployment, "component")[0] ?? "",
    instances: graph.navigate(deployment, "instances").map((id) => ({
      id,
      name: nameOf(graph, id) ?? "",
      of: graph.navigate(id, "of")[0] ?? "",
      runs: graph.navigate(id, "runs")[0] ?? null,
      ...writeRange(graph, id),
    })),
    connections: graph.navigate(deployment, "connections").map((id) =>
      Object.assign(
        {
          id,
          from: graph.navigate(id, "from")[0] ?? "",
          to: graph.navigate(id, "to")[0] ?? null,
          toComponent: graph.navigate(id, "toComponent")[0] ?? null,
          toIdentity: graph.navigate(id, "toIdentity")[0] ?? null,
          what: graph.navigate(id, "what"),
        },
        ...extensions.map((extension) => extension.writeConnection(graph, id)),
      ),
    ),
    imports: writeImports(graph, deployment, [layer]),
    exposes: graph.navigate(deployment, "exposes").map((id) => ({ id, instance: graph.navigate(id, "instance")[0] ?? "" })),
  };
}
