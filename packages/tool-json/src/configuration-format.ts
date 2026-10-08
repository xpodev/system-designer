/**
 * ConfigurationFormat: a System's Configurations, as JSON. A Configuration nests its choices
 * as a tree: the first chooses a Deployment of the root, and each below it chooses a
 * Deployment for one Instance of the Deployment chosen above. Choices have no ids of their
 * own: they are owned by their Configuration and identified by position.
 */
import { nameOf, setName, type Graph } from "@systemathic/core";
import type { Extension } from "./contexts-format.js";
import { array, object, string, type Reader } from "./reader.js";

export interface ChoiceJson { instance: string | null; deployment: string; choices: ChoiceJson[] }
export interface ConfigurationJson { id: string; name: string; root: ChoiceJson }

/** The Configuration layer of a System: `configurations`. */
export const configurations: Extension = {
  readSystem(reader, system, json, at) {
    array(json.configurations, `${at}.configurations`).forEach((value, index) => {
      const where = `${at}.configurations[${index}]`;
      const configuration = object(value, where);
      const id = reader.create("Configuration", configuration.id, where);
      if (id === undefined) return;
      setName(reader.graph, id, string(configuration.name, `${where}.name`));
      reader.graph.connect(system, "configurations", id);
      const root = readChoice(reader, configuration.root, `${where}.root`, `${id}#root`);
      if (root !== undefined) reader.graph.connect(id, "root", root);
    });
  },
  writeSystem: (graph, system) => ({
    configurations: graph.navigate(system, "configurations").map((id): ConfigurationJson => {
      const [root] = graph.navigate(id, "root");
      return { id, name: nameOf(graph, id) ?? "", root: root === undefined ? { instance: null, deployment: "", choices: [] } : writeChoice(graph, root) };
    }),
  }),
};

function readChoice(reader: Reader, value: unknown, at: string, id: string): string | undefined {
  const json = object(value, at);
  const choice = reader.create("Choice", id, at);
  if (choice === undefined) return undefined;
  if (json.instance !== null) reader.refer(choice, "instance", json.instance, `${at}.instance`);
  reader.refer(choice, "deployment", json.deployment, `${at}.deployment`);
  array(json.choices, `${at}.choices`).forEach((value, index) => {
    const child = readChoice(reader, value, `${at}.choices[${index}]`, `${id}.${index}`);
    if (child !== undefined) reader.graph.connect(choice, "choices", child);
  });
  return choice;
}

function writeChoice(graph: Graph, choice: string): ChoiceJson {
  return {
    instance: graph.navigate(choice, "instance")[0] ?? null,
    deployment: graph.navigate(choice, "deployment")[0] ?? "",
    choices: graph.navigate(choice, "choices").map((child) => writeChoice(graph, child)),
  };
}
