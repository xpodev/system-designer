import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { run, type Io } from "../src/cli.js";

function io(files: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const fake: Io = {
    readFile: (path) => {
      if (path in files) return files[path]!;
      return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
    },
    writeFile: (path, content) => void (files[path] = content),
    exists: (path) => path in files,
    out: (line) => void out.push(line),
    err: (line) => void err.push(line),
  };
  return { fake, out, err, files };
}

describe("systemathic", () => {
  it("check: exits 0 on a well-formed System", async () => {
    const { fake, out } = io();
    expect(await run(["check", "examples/game.systemathic.json"], fake)).toBe(0);
    expect(out.at(-1)).toBe("examples/game.systemathic.json: 0 structural errors, 0 load problems");
  });

  it("check: exits 1 and names what is wrong", async () => {
    const { fake, out } = io();
    expect(await run(["check", "examples/broken/w3.systemathic.json"], fake)).toBe(1);
    expect(out.join("\n")).toContain("error  W3");
    expect(out.join("\n")).toContain("end 'hunters' at Player");
  });

  it("check: reports load problems", async () => {
    const { fake, out } = io();
    expect(await run(["check", "examples/broken/dangling.systemathic.json"], fake)).toBe(1);
    expect(out[0]).toBe("load   $.design.mediations[0].how: refers to 'd.nowhere', which does not exist");
  });

  it("check: exits 2 on a file that is not a System", async () => {
    const { fake, err } = io({ "x.json": '{"format": "other"}' });
    expect(await run(["check", "x.json"], fake)).toBe(2);
    expect(err[0]).toContain("not a System file");
  });

  it("new: writes an empty System that checks clean, and never overwrites", async () => {
    const { fake, files } = io();
    expect(await run(["new", "blank.json", "Blank"], fake)).toBe(0);
    expect(JSON.parse(files["blank.json"]!).design.name).toBe("Blank");
    expect(await run(["check", "blank.json"], fake)).toBe(0);
    expect(await run(["new", "blank.json"], fake)).toBe(2);
  });

  it("verify: runs a script's profile and exits 0 when no rule finds an error", async () => {
    const { fake, out } = io();
    expect(await run(["verify", "examples/tool-design.systemathic.json", "examples/tool-design.rules.py"], fake)).toBe(0);
    expect(out.at(-1)).toMatch(/^examples\/tool-design.systemathic.json: profile \(16 rules\): 0 errors, \d+ warnings, 0 failed rules$/);
  }, 30_000);

  it("verify: uses the standard rules when the System names no profile", async () => {
    const { fake, out } = io();
    expect(await run(["verify", "examples/game.systemathic.json"], fake)).toBe(0);
    expect(out).toContain("warning completeness: Combat as GameObjects leaves 2 item(s) of Combat neither mapped nor deferred");
    expect(out.at(-1)).toBe("examples/game.systemathic.json: standard (9 rules): 0 errors, 1 warning, 0 failed rules");
  }, 30_000);

  it("verify: refuses a System with structural errors", async () => {
    const { fake, err } = io();
    expect(await run(["verify", "examples/broken/w3.systemathic.json"], fake)).toBe(1);
    expect(err[0]).toContain("solve them before verifying");
  });

  it("verify: exits 1 when a rule fails", async () => {
    const { fake, out } = io();
    expect(await run(["verify", "examples/game.systemathic.json", "python/tests/broken_rules.py"], fake)).toBe(1);
    expect(out.at(-1)).toContain("1 failed rule");
  }, 30_000);

  it("prints usage on anything else", async () => {
    const { fake, err } = io();
    expect(await run([], fake)).toBe(2);
    expect(err[0]).toMatch(/^usage/);
  });
});
