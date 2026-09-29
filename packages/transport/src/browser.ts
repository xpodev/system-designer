import type { Project } from "@save/engine";
import type { IStorageTransport, WorkspaceFile } from "./types.js";

const DB_NAME = "SAVE_LocalWorkspace";
const PROJECTS_STORE = "projects";
const FILES_STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) db.createObjectStore(PROJECTS_STORE);
      if (!db.objectStoreNames.contains(FILES_STORE)) db.createObjectStore(FILES_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Real IndexedDB storage, not a stub: `projects` holds `projectId ->
 * Project` (IndexedDB's structured clone supports Map values natively, so
 * Domains and Languages — which hold Maps and Sets — round-trip without a
 * custom serializer); `files`
 * holds `path -> WorkspaceFile`, giving listFiles/readFile/writeFile a real
 * (if virtual, in-browser) backing store rather than no-ops.
 *
 * `subscribeToChanges` is a no-op unsubscribe, per spec — live file-watching
 * needs the WebSocket-backed HTTP transport, which is a later instance behind
 * this same interface.
 */
export class BrowserStorageTransport implements IStorageTransport {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await openDb();
  }

  private async getDb(): Promise<IDBDatabase> {
    if (!this.db) this.db = await openDb();
    return this.db;
  }

  async loadProject(projectId: string): Promise<Project> {
    const db = await this.getDb();
    const project = await withStore<Project | undefined>(db, PROJECTS_STORE, "readonly", (store) =>
      store.get(projectId)
    );
    return project ?? { languages: new Map(), domains: [], mediations: [] };
  }

  async saveProject(projectId: string, project: Project): Promise<void> {
    const db = await this.getDb();
    await withStore(db, PROJECTS_STORE, "readwrite", (store) => store.put(project, projectId));
  }

  async listFiles(path: string): Promise<string[]> {
    const db = await this.getDb();
    const keys = await withStore<IDBValidKey[]>(db, FILES_STORE, "readonly", (store) =>
      store.getAllKeys()
    );
    const prefix = path.endsWith("/") ? path : `${path}/`;
    return (keys as string[]).filter((key) => path === "" || key.startsWith(prefix));
  }

  async readFile(path: string): Promise<string> {
    const db = await this.getDb();
    const file = await withStore<WorkspaceFile | undefined>(db, FILES_STORE, "readonly", (store) =>
      store.get(path)
    );
    if (!file) throw new Error(`No such file: ${path}`);
    return file.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const db = await this.getDb();
    const file: WorkspaceFile = { path, content, updatedAt: Date.now() };
    await withStore(db, FILES_STORE, "readwrite", (store) => store.put(file, path));
  }

  subscribeToChanges(_callback: (file: WorkspaceFile) => void): () => void {
    return () => {};
  }
}

export const browserStorageTransport = new BrowserStorageTransport();
