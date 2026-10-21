/**
 * The files a Host reads and writes: Systems, scripts, packages. Paths are relative to the
 * Host's workspace, with forward slashes; `resolve` gives the one form two names of the same
 * file share.
 */
export interface Files {
  resolve(path: string): string;
  /** A file's text; undefined if there is none. */
  read(path: string): Promise<string | undefined>;
  write(path: string, text: string): Promise<void>;
  /** The files whose names end with `suffix`, sorted. */
  list(suffix: string): Promise<string[]>;
}
