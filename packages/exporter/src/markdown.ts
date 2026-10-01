/**
 * MarkdownExport (docs/tool-design.md, `Exporter / Markdown`): a Specification as Markdown,
 * for a person or an LLM. Sections are headings; Statements, Requirements and Obligations are
 * list items, each led by its stable id in brackets. What a reader need not see — the ids of
 * a Statement's subjects, a Requirement's script — is in an HTML comment, so the document
 * reads back into exactly the Specification it came from.
 */
import type { Obligation, ObligationKind, Requirement, Section, Specification, Statement } from "./specification.js";

const PREAMBLE =
  "This is a specification: what an implementation of this design may contain, and what it must satisfy. " +
  "Each item has an id, in brackets, to refer to it by.";

export function toMarkdown(specification: Specification): string {
  const lines = [`# ${specification.system}`, "", PREAMBLE, ""];
  const section = (s: Section, depth: number) => {
    lines.push(`${"#".repeat(depth)} ${s.title} {#${s.id}}`, "");
    if (s.statements.length > 0) lines.push(...s.statements.map(statementLine), "");
    for (const sub of s.sections) section(sub, depth + 1);
  };
  for (const s of specification.sections) section(s, 2);
  lines.push("## Requirements {#requirements}", "");
  if (specification.requirements.length > 0) lines.push(...specification.requirements.map(requirementLine), "");
  lines.push("## Obligations {#obligations}", "");
  if (specification.obligations.length > 0) lines.push(...specification.obligations.map(obligationLine), "");
  return lines.join("\n");
}

const statementLine = (s: Statement) => `- [${s.id}] ${s.text} <!-- ${s.subjects.join(" ")} -->`;
const requirementLine = (r: Requirement) => `- [${r.id}] **${r.severity}** \`${r.rule}\`: ${r.about} <!-- ${r.script} -->`;
const obligationLine = (o: Obligation) => `- [${o.id}] **${o.kind}** ${o.text} <!-- ${o.subjects.join(" ")} -->`;

const HEADING = /^(#{2,}) (.*) \{#([^}]+)\}$/;
const STATEMENT = /^- \[([^\]]+)\] (.*) <!-- ?(.*?) ?-->$/;
const REQUIREMENT = /^- \[([^\]]+)\] \*\*(error|warning)\*\* `([^`]+)`: (.*) <!-- (.*) -->$/;
const OBLIGATION = /^- \[([^\]]+)\] \*\*(O[123])\*\* (.*) <!-- ?(.*?) ?-->$/;

export class MarkdownError extends Error {}

/** Reads a document written by `toMarkdown` back into its Specification. */
export function fromMarkdown(markdown: string): Specification {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const title = lines[0]?.match(/^# (.*)$/);
  if (!title) throw new MarkdownError("line 1: expected the System's name as a '# ' heading");

  interface Open { id: string; title: string; statements: Statement[]; sections: Open[] }
  const roots: Open[] = [];
  const stack: { depth: number; section: Open }[] = [];
  const requirements: Requirement[] = [];
  const obligations: Obligation[] = [];
  let mode: "sections" | "requirements" | "obligations" | undefined;

  lines.forEach((line, index) => {
    const heading = line.match(HEADING);
    if (heading) {
      const depth = heading[1]!.length;
      const id = heading[3]!;
      if (depth === 2 && (id === "requirements" || id === "obligations")) {
        mode = id;
        return;
      }
      mode = "sections";
      const section: Open = { id, title: heading[2]!, statements: [], sections: [] };
      while (stack.length > 0 && stack.at(-1)!.depth >= depth) stack.pop();
      (stack.at(-1)?.section.sections ?? roots).push(section);
      stack.push({ depth, section });
      return;
    }
    if (!line.startsWith("- ")) return;
    const at = `line ${index + 1}`;
    if (mode === "requirements") {
      const m = line.match(REQUIREMENT);
      if (!m) throw new MarkdownError(`${at}: expected a requirement`);
      requirements.push({ id: m[1]!, severity: m[2] as Requirement["severity"], rule: m[3]!, about: m[4]!, script: m[5]! });
    } else if (mode === "obligations") {
      const m = line.match(OBLIGATION);
      if (!m) throw new MarkdownError(`${at}: expected an obligation`);
      obligations.push({ id: m[1]!, kind: m[2] as ObligationKind, text: m[3]!, subjects: split(m[4]!) });
    } else {
      const m = line.match(STATEMENT);
      const section = stack.at(-1)?.section;
      if (!m || !section) throw new MarkdownError(`${at}: expected a statement in a section`);
      section.statements.push({ id: m[1]!, text: m[2]!, subjects: split(m[3]!) });
    }
  });
  return { system: title[1]!, sections: roots, requirements, obligations };
}

const split = (ids: string) => ids.split(" ").filter((id) => id.length > 0);
