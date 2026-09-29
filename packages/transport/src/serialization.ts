import type { Entity, Interaction, Project, Transformation } from "@save/engine";

/**
 * JSON-safe wire shapes (Maps and Sets replaced with arrays) for transports
 * that go over the network, where they don't survive `JSON.stringify`.
 * BrowserStorageTransport doesn't need this — IndexedDB's structured clone
 * supports `Map`/`Set` natively — so this lives here, not in @save/engine,
 * which stays ignorant of any storage format.
 */

interface WireLanguage {
  id: string;
  name: string;
  entities: Entity[];
  interactions: Interaction[];
}

interface WireDomain {
  id: string;
  name: string;
  /** Domain.languageIds, a Set of references — not owned Language values. */
  languageIds: string[];
  transformations: Transformation[];
  isPure: boolean;
}

export interface WireProject {
  languages: WireLanguage[];
  domains: WireDomain[];
  mediations: Project["mediations"];
}

export function serializeProject(project: Project): WireProject {
  return {
    languages: Array.from(project.languages.values()).map((language) => ({
      id: language.id,
      name: language.name,
      entities: Array.from(language.entities.values()),
      interactions: Array.from(language.interactions.values()),
    })),
    domains: project.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      languageIds: Array.from(domain.languageIds),
      transformations: Array.from(domain.transformations.values()),
      isPure: domain.isPure,
    })),
    mediations: project.mediations,
  };
}

export function deserializeProject(wire: WireProject): Project {
  return {
    languages: new Map(
      wire.languages.map((language) => [
        language.id,
        {
          id: language.id,
          name: language.name,
          entities: new Map(language.entities.map((entity) => [entity.id, entity])),
          interactions: new Map(language.interactions.map((i) => [i.id, i])),
        },
      ])
    ),
    domains: wire.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      languageIds: new Set(domain.languageIds),
      transformations: new Map(domain.transformations.map((t) => [t.id, t])),
      isPure: domain.isPure,
    })),
    mediations: wire.mediations ?? [],
  };
}
