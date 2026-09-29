/**
 * A directory of known project ids and their display names, kept in
 * localStorage. This is deliberately NOT part of @save/engine's domain
 * (a Project is just `{ languages, domains, mediations }` — it has no name) and not part
 * of @save/transport either (a transport only knows how to load/save a
 * project by id, not how to list or label them). A name is bookkeeping for
 * whichever UI is presenting a directory of systems to choose from, so it
 * lives here, in the app, alongside the id it labels.
 */

const STORAGE_KEY = "save.projectRegistry";
const ACTIVE_KEY = "save.activeProjectId";

export interface ProjectRegistryEntry {
  id: string;
  name: string;
  updatedAt: number;
}

function readRegistry(): ProjectRegistryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProjectRegistryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeRegistry(entries: ProjectRegistryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Best-effort — a private window or a full quota just means no directory.
  }
}

export function listProjects(): ProjectRegistryEntry[] {
  return readRegistry().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function registerProject(id: string, name: string): void {
  const entries = readRegistry().filter((e) => e.id !== id);
  entries.push({ id, name, updatedAt: Date.now() });
  writeRegistry(entries);
}

export function touchProject(id: string): void {
  const entries = readRegistry();
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    entry.updatedAt = Date.now();
    writeRegistry(entries);
  }
}

export function projectName(id: string): string {
  return readRegistry().find((e) => e.id === id)?.name ?? id;
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignored — worst case, the app reopens on whatever the default is
  }
}
