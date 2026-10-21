/**
 * The JSON File Repository (docs/system-designer.md): a System as a JSON file, its location the
 * file's path among the Host's files. It writes the design, and the attachments as they are,
 * reading none of them.
 */
import { NotASystem, type Repository } from "@systemathic/tool";
import { FormatError, readSystem, writeSystem } from "@systemathic/tool-json";
import type { Files } from "./files.js";

export class JsonFileRepository implements Repository {
  constructor(private readonly files: Files) {}

  resolve(location: string): string {
    return this.files.resolve(location);
  }

  async open(location: string) {
    const text = await this.files.read(this.resolve(location));
    if (text === undefined) return undefined;
    try {
      return readSystem(JSON.parse(text));
    } catch (error) {
      if (error instanceof FormatError || error instanceof SyntaxError) throw new NotASystem(`not a System file: ${error.message}`);
      throw error;
    }
  }

  async save(system: Parameters<Repository["save"]>[0], location: string): Promise<string> {
    const where = this.resolve(location);
    await this.files.write(where, JSON.stringify(writeSystem(system), null, 2) + "\n");
    return where;
  }
}
