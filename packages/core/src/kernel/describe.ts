/** A short, human-readable name for an instance, for messages. */
import type { Graph } from "./graph.js";
import { nameOf } from "./values.js";

export function describe(graph: Graph, id: string): string {
  if (!graph.has(id)) return id;
  const instance = graph.get(id);
  if (instance.value !== undefined) return `${instance.entity} ${JSON.stringify(instance.value)}`;
  const name = graph.vocabulary.step(instance.entity, "name") ? nameOf(graph, id) : undefined;
  if (instance.entity === "End") {
    const [entity] = graph.navigate(id, "entity");
    const owner = entity === undefined ? "?" : (nameOf(graph, entity) ?? entity);
    return name === undefined ? `unnamed end at ${owner}` : `end '${name}' at ${owner}`;
  }
  if (instance.entity === "Relationship") {
    const sides = graph.navigate(id, "ends").map((end) => {
      const [entity] = graph.navigate(end, "entity");
      return entity === undefined ? "?" : (nameOf(graph, entity) ?? entity);
    });
    return `Relationship ${sides.join(" <——> ")}`;
  }
  return name === undefined ? `${instance.entity} ${id}` : `${instance.entity} '${name}'`;
}
