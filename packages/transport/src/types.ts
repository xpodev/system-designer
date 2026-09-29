import type { Project } from "@save/engine";

export interface WorkspaceFile {
  path: string;
  content: string;
  updatedAt: number;
}

/**
 * The A/M seam: the editor core talks only to this interface. Swapping
 * BrowserStorageTransport for an HTTP/FastAPI-backed transport later is a new
 * instance behind this same interface, not a change to anything that depends
 * on it.
 *
 * `loadProject`/`saveProject` carry a `Project` (shared, top-level Languages
 * + the Domains that reference them + A/M mediations) rather than bare
 * `Layer[]` — the spec's own `MediationNode` type had no persisted home
 * until `Project` was added; this is that seam's minimal extension, not a
 * divergent redesign.
 */
export interface IStorageTransport {
  init(): Promise<void>;
  loadProject(projectId: string): Promise<Project>;
  saveProject(projectId: string, project: Project): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  subscribeToChanges(callback: (file: WorkspaceFile) => void): () => void;
}
