/**
 * Hosting in a local process (docs/tool-design.md, `Tool / Host`): the Host with the disk for
 * its files, Python for its rules, and the standard catalog from this repository's catalog/
 * folder; and the Host over HTTP, for the UI and the MCP server to share.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Catalog, parsePackage } from "@systemathic/catalog";
import { DEFAULT_PORT, Host, type Files } from "@systemathic/host";
import { PythonHost } from "@systemathic/python-host";

export { serve, type ServeOptions } from "./server.js";

/** Where a host listens, unless told otherwise: `SYSTEMATHIC_HOST`, or port 4747 on this machine. */
export const DEFAULT_HOST = process.env.SYSTEMATHIC_HOST ?? `http://127.0.0.1:${DEFAULT_PORT}`;

/** The folder of the standard catalog. */
export const STANDARD_CATALOG = fileURLToPath(new URL("../../../catalog/", import.meta.url));

/** Folders not worth looking into for System files. */
const SKIP = new Set(["node_modules", "dist", "dist-static"]);

/** Files on disk, under a folder; paths outside it are allowed, and named relative to it. */
export class NodeFiles implements Files {
  constructor(readonly root = process.cwd()) {}

  resolve(path: string): string {
    return relative(this.root, resolve(this.root, path)).split(sep).join("/");
  }

  async read(path: string): Promise<string | undefined> {
    const file = resolve(this.root, path);
    return existsSync(file) ? readFileSync(file, "utf8") : undefined;
  }

  async write(path: string, text: string): Promise<void> {
    const file = resolve(this.root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }

  async list(suffix: string): Promise<string[]> {
    const found: string[] = [];
    const walk = (dir: string, depth: number) => {
      for (const entry of readdirSync(join(this.root, dir), { withFileTypes: true })) {
        const path = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory() && depth < 4 && !entry.name.startsWith(".") && !SKIP.has(entry.name)) walk(path, depth + 1);
        else if (entry.isFile() && entry.name.endsWith(suffix)) found.push(path);
      }
    };
    walk("", 0);
    return found.sort();
  }
}

/** The standard catalog, read from its folder. */
export function standardCatalog(folder = STANDARD_CATALOG): Catalog {
  const files = readdirSync(folder).filter((file) => file.endsWith(".systemathic.json")).sort();
  return new Catalog(files.map((file) => parsePackage(JSON.parse(readFileSync(join(folder, file), "utf8")), "standard", file)));
}

/** A Host on this machine: files under `cwd`, rules run by Python, the standard catalog. */
export function nodeHost(options: { cwd?: string; catalog?: Catalog; python?: string } = {}): Host {
  const cwd = options.cwd ?? process.cwd();
  return new Host({ files: new NodeFiles(cwd), catalog: options.catalog ?? standardCatalog(), scripts: new PythonHost(options.python, cwd) });
}
