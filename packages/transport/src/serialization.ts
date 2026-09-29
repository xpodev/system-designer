import type { Entity, Interaction, Project, Transformation } from "@save/engine";

/**
 * JSON-safe wire shapes (Maps replaced with arrays) for transports that go
 * over the network, where `Map` doesn't survive `JSON.stringify`.
 * BrowserStorageTransport doesn't need this — IndexedDB's structured clone
 * supports `Map` natively — so this lives here, not in @save/engine, which
 * stays ignorant of any storage format.
 */

interface WireLanguage {
  id: string;
  name: string;
  entities: Entity[];
  interactions: Interaction[];
}

interface WireLayer {
  id: string;
  name: string;
  languages: WireLanguage[];
  transformations: Transformation[];
  isPure: boolean;
}

export interface WireProject {
  layers: WireLayer[];
  mediations: Project["mediations"];
}

export function serializeProject(project: Project): WireProject {
  return {
    layers: project.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      isPure: layer.isPure,
      languages: Array.from(layer.languages.values()).map((language) => ({
        id: language.id,
        name: language.name,
        entities: Array.from(language.entities.values()),
        interactions: Array.from(language.interactions.values()),
      })),
      transformations: Array.from(layer.transformations.values()),
    })),
    mediations: project.mediations,
  };
}

export function deserializeProject(wire: WireProject): Project {
  return {
    mediations: wire.mediations ?? [],
    layers: wire.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      isPure: layer.isPure,
      languages: new Map(
        layer.languages.map((language) => [
          language.id,
          {
            id: language.id,
            name: language.name,
            entities: new Map(language.entities.map((entity) => [entity.id, entity])),
            interactions: new Map(language.interactions.map((i) => [i.id, i])),
          },
        ])
      ),
      transformations: new Map(layer.transformations.map((t) => [t.id, t])),
    })),
  };
}
