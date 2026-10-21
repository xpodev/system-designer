/**
 * The Workspace (docs/system-designer.md): the Systems open in the tool. `new` starts an empty
 * one; `open` reads one through the Repository and asks every Metadata Provider to load into
 * it; `save` asks every provider to save into a copy of it, then writes the copy through the
 * Repository. Each open System is a Target, with every Edit Listener connected to it. It is the
 * only part that knows both the Repository and the providers.
 */
import { Target } from "@systemathic/editing";
import { newSystem, open, save, type MetadataProvider, type Repository, type StorageProblem, type SystemContext, type ToolSystem } from "@systemathic/tool";

/** Connects an Edit Listener to the Target of an open System, to be told of every Edit on it. */
export type Listen = (target: Target) => unknown;

/** A System open in the Workspace: its Target, where it is stored, if anywhere, and how much of its History is. */
export interface OpenSystem {
  readonly id: string;
  readonly target: Target;
  location?: string;
  /** How many Edits the History had when it was last read from or written to its location. */
  saved: number;
}

export class Workspace {
  private readonly systems = new Map<string, OpenSystem>();
  private next = 1;

  constructor(
    private readonly repository: Repository,
    private readonly providers: readonly MetadataProvider[],
    private readonly listeners: readonly Listen[],
    /** Told of each System as it is opened, once its listeners are connected. */
    private readonly opened: (system: OpenSystem) => void = () => {},
  ) {}

  /** Every open System, in the order they were opened. */
  get all(): OpenSystem[] {
    return [...this.systems.values()];
  }

  get(id: string): OpenSystem | undefined {
    return this.systems.get(id);
  }

  /** The one form two names of the same location share. */
  resolve(location: string): string {
    return this.repository.resolve(location);
  }

  /** `new(name) → Open System`: an empty System, stored nowhere yet. */
  async new(name: string): Promise<OpenSystem> {
    return this.host(newSystem(name), undefined);
  }

  /**
   * `open(location) → Open System`, with what could not be followed in it. A location already
   * open is the same open System, so everyone editing it edits one History. Undefined if
   * nothing is stored there.
   */
  async open(location: string): Promise<{ system: OpenSystem; problems: readonly StorageProblem[] } | undefined> {
    const where = this.resolve(location);
    const already = this.all.find((system) => system.location === where);
    if (already !== undefined) return { system: already, problems: [] };
    const read = await this.repository.open(where);
    if (read === undefined) return undefined;
    return { system: await this.host(open(read.system), where), problems: read.problems };
  }

  /** `save(Open System, location) → location`: where it was stored, its own location if none is given. */
  async save(system: OpenSystem, location = system.location): Promise<string> {
    if (location === undefined) throw new Error("this System is stored nowhere yet: save it to a location");
    const where = await this.repository.save(await this.stored(system, this.resolve(location)), this.resolve(location));
    system.location = where;
    system.saved = system.target.history.edits.length;
    return where;
  }

  /** An open System as it would be stored at `location`: a copy, into which every provider has saved its metadata. */
  async stored(system: OpenSystem, location = system.location): Promise<ToolSystem> {
    const copy = open(save(system.target.context));
    for (const provider of this.providers) await provider.save(copy, location);
    return save(copy);
  }

  private async host(context: SystemContext, location: string | undefined): Promise<OpenSystem> {
    for (const provider of this.providers) await provider.load(context, location);
    const target = new Target(context);
    const system: OpenSystem = { id: `c${this.next++}`, target, saved: 0, ...(location === undefined ? {} : { location }) };
    for (const listen of this.listeners) listen(target);
    this.systems.set(system.id, system);
    this.opened(system);
    return system;
  }
}
