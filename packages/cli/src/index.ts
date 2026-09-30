#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { run } from "./cli.js";

process.exitCode = run(process.argv.slice(2), {
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, content) => writeFileSync(path, content),
  exists: (path) => existsSync(path),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
