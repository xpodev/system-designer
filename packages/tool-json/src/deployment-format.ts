/**
 * DeploymentFormat: a Component's Deployments, as JSON. A Deployment nests its named
 * Instances, each with its range, and its Connections; a Connection refers to the Instance it goes from, the
 * Instance or Component it goes to, and the Interactions of its What. Layers above Deployment
 * add their parts of a Connection through the extension hooks.
 */
import { nameOf, setName, type Graph } from "@systemathic/core";
import type { Extension } from "./contexts-format.js";
import { readRange, writeRange } from "./kernel-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface InstanceJson { id: string; name: string; of: string; min: number; max: number | "N" }
export interface ConnectionJson { id: string; from: string; to: string | null; toComponent: string | null; what: string[] }
export interface DeploymentJson { id: string; name: string; instances: InstanceJson[]; connections: ConnectionJson[] }

/** What a layer above Deployment reads into, and writes from, a Connection. */
export interface ConnectionExtension {
  readConnection(reader: Reader, connection: string, json: Record<string, unknown>, at: string): void;
  writeConnection(graph: Graph, connection: string): Record<string, unknown>;
}

/** The Deployment layer of a Component: `deployments`. */
export function deployment(extensions: readonly ConnectionExtension[] = []): Extension {
  return {
    readComponent(reader, component, json, at) {
      array(json.deployments, `${at}.deployments`).forEach((value, index) => {
        readDeployment(reader, component, value, `${at}.deployments[${index}]`, extensions);
      });
    },
    writeComponent: (graph, component) => ({
      deployments: graph.navigate(component, "deployments").map((id) => writeDeployment(graph, id, extensions)),
    }),
  };
}

function readDeployment(reader: Reader, component: string, value: unknown, at: string, extensions: readonly ConnectionExtension[]): void {
  const graph = reader.graph;
  const json = object(value, at);
  const id = reader.create("Deployment", json.id, at);
  if (id === undefined) return;
  setName(graph, id, string(json.name, `${at}.name`));
  graph.connect(component, "deployments", id);
  array(json.instances, `${at}.instances`).forEach((value, index) => {
    const where = `${at}.instances[${index}]`;
    const instance = object(value, where);
    const instanceId = reader.create("Instance", instance.id, where);
    if (instanceId === undefined) return;
    setName(graph, instanceId, string(instance.name, `${where}.name`));
    graph.connect(id, "instances", instanceId);
    reader.refer(instanceId, "of", instance.of, `${where}.of`);
    readRange(reader, instanceId, instance, where);
  });
  array(json.connections, `${at}.connections`).forEach((value, index) => {
    const where = `${at}.connections[${index}]`;
    const connection = object(value, where);
    const connectionId = reader.create("Connection", connection.id, where);
    if (connectionId === undefined) return;
    graph.connect(id, "connections", connectionId);
    reader.refer(connectionId, "from", connection.from, `${where}.from`);
    if (connection.to !== null) reader.refer(connectionId, "to", connection.to, `${where}.to`);
    if (connection.toComponent !== null) reader.refer(connectionId, "toComponent", connection.toComponent, `${where}.toComponent`);
    array(connection.what, `${where}.what`).forEach((ref, i) => reader.refer(connectionId, "what", ref, `${where}.what[${i}]`));
    for (const extension of extensions) extension.readConnection(reader, connectionId, connection, where);
  });
}

function writeDeployment(graph: Graph, deployment: string, extensions: readonly ConnectionExtension[]): DeploymentJson {
  return {
    id: deployment,
    name: nameOf(graph, deployment) ?? "",
    instances: graph.navigate(deployment, "instances").map((id) => ({
      id,
      name: nameOf(graph, id) ?? "",
      of: graph.navigate(id, "of")[0] ?? "",
      ...writeRange(graph, id),
    })),
    connections: graph.navigate(deployment, "connections").map((id) =>
      Object.assign(
        {
          id,
          from: graph.navigate(id, "from")[0] ?? "",
          to: graph.navigate(id, "to")[0] ?? null,
          toComponent: graph.navigate(id, "toComponent")[0] ?? null,
          what: graph.navigate(id, "what"),
        },
        ...extensions.map((extension) => extension.writeConnection(graph, id)),
      ),
    ),
  };
}
