import type { Project } from "@save/engine";
import { deserializeProject, serializeProject } from "./serialization.js";
import type { IStorageTransport, WorkspaceFile } from "./types.js";

/**
 * The other instance behind IStorageTransport, per spec §5.2 — talks to the
 * FastAPI server in apps/server. Nothing in packages/engine or the app's
 * state layer changes to support this; only which transport gets constructed
 * changes.
 */
export class HttpStorageTransport implements IStorageTransport {
  constructor(private baseUrl: string) {}

  async init(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/health`);
    if (!res.ok) throw new Error("FastAPI server unavailable");
  }

  async loadProject(projectId: string): Promise<Project> {
    const res = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}`);
    if (res.status === 404) return { languages: new Map(), domains: [], mediations: [] };
    if (!res.ok) throw new Error(`Failed to load project: ${res.status}`);
    return deserializeProject(await res.json());
  }

  async saveProject(projectId: string, project: Project): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(serializeProject(project)),
    });
    if (!res.ok) throw new Error(`Failed to save project: ${res.status}`);
  }

  async listFiles(path: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/fs/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`Failed to list files: ${res.status}`);
    return res.json();
  }

  async readFile(path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/v1/fs/read?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`Failed to read file: ${res.status}`);
    return res.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/fs/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) throw new Error(`Failed to write file: ${res.status}`);
  }

  subscribeToChanges(callback: (file: WorkspaceFile) => void): () => void {
    const ws = new WebSocket(`${this.baseUrl.replace(/^http/, "ws")}/api/v1/ws`);
    ws.onmessage = (event) => callback(JSON.parse(event.data));
    return () => ws.close();
  }
}
