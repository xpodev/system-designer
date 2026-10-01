/**
 * Copying from one model into another: instances with everything they own, and the links
 * among them. Names and Bounds are values, so they are not copied but found or made in the
 * target. A link to something outside what is copied is kept only if that thing was copied
 * before — `copied` maps every source id already copied to its id in the target — and is
 * dropped otherwise. Ids are kept where the target does not already use them.
 */
import type { Graph } from "./graph.js";
import type { Composition } from "./removal.js";
import { boundInstance, nameInstance } from "./values.js";

/** Copies `roots` and what they own into `target`; adds every copied id to `copied`, and returns the roots' new ids. */
export function copyInto(source: Graph, target: Graph, roots: readonly string[], rules: Composition, copied: Map<string, string>): string[] {
  const subtree: string[] = [];
  const pending = [...roots];
  while (pending.length > 0) {
    const id = pending.shift()!;
    if (copied.has(id) || subtree.includes(id) || !source.has(id)) continue;
    subtree.push(id);
    for (const end of rules.owning.get(source.get(id).entity) ?? []) pending.push(...source.navigate(id, end));
  }

  const taken = new Set<string>();
  for (const id of subtree) {
    const instance = source.get(id);
    let fresh = id;
    for (let n = 2; target.has(fresh) || taken.has(fresh); n++) fresh = `${id}~${n}`;
    taken.add(fresh);
    target.add(instance.entity, fresh, instance.value);
    copied.set(id, fresh);
  }

  const inSubtree = new Set(subtree);
  const resolve = (id: string): string | undefined => {
    const instance = source.get(id);
    if (instance.entity === "Name") return nameInstance(target, String(instance.value));
    if (instance.entity === "Bound") return boundInstance(target, Number(instance.value));
    return copied.get(id);
  };
  for (const relationship of source.vocabulary.spec.relationships) {
    for (const [a, b] of source.links(relationship.id)) {
      if (!inSubtree.has(a) && !inSubtree.has(b)) continue;
      const [ta, tb] = [resolve(a), resolve(b)];
      if (ta !== undefined && tb !== undefined && target.vocabulary.relationship(relationship.id)) target.link(relationship.id, ta, tb);
    }
  }
  return roots.map((root) => copied.get(root)!).filter((id) => id !== undefined);
}
