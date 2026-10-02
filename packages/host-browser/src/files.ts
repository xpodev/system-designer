/**
 * Files in a browser: text by path, kept in the browser's storage (IndexedDB), or in memory.
 * They stay in this browser; a person brings files in by opening them from their computer and
 * takes them out by downloading them.
 */
import type { Files } from "@systemathic/host";

/** Where the text of each path is kept. */
export interface Store {
  get(path: string): Promise<string | undefined>;
  set(path: string, text: string): Promise<void>;
  paths(): Promise<string[]>;
}

export class MemoryStore implements Store {
  private readonly texts = new Map<string, string>();

  async get(path: string) {
    return this.texts.get(path);
  }
  async set(path: string, text: string) {
    this.texts.set(path, text);
  }
  async paths() {
    return [...this.texts.keys()];
  }
}

/** The browser's IndexedDB: what is kept survives reloading the page, in this browser. */
export class IndexedDbStore implements Store {
  private readonly db: Promise<IDBDatabase>;

  constructor(name = "systemathic") {
    this.db = new Promise((done, fail) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files");
      request.onsuccess = () => done(request.result);
      request.onerror = () => fail(request.error);
    });
  }

  private async files<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db;
    return new Promise((done, fail) => {
      const request = act(db.transaction("files", mode).objectStore("files"));
      request.onsuccess = () => done(request.result);
      request.onerror = () => fail(request.error);
    });
  }

  get(path: string) {
    return this.files("readonly", (store) => store.get(path) as IDBRequest<string | undefined>);
  }
  async set(path: string, text: string) {
    await this.files("readwrite", (store) => store.put(text, path));
  }
  async paths() {
    return (await this.files("readonly", (store) => store.getAllKeys())).map(String);
  }
}

/** A path's one form: forward slashes, no `.` or `..` steps, nothing before the first name. */
export function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.split(/[\\/]+/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

export class BrowserFiles implements Files {
  constructor(readonly store: Store) {}

  resolve(path: string): string {
    return normalize(path);
  }
  read(path: string) {
    return this.store.get(normalize(path));
  }
  write(path: string, text: string) {
    return this.store.set(normalize(path), text);
  }
  async list(suffix: string) {
    return (await this.store.paths()).filter((path) => path.endsWith(suffix)).sort();
  }
}
