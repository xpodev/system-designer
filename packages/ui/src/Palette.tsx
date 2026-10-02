/** The command palette: everything in the System to go to, and everything to do, by typing. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Kind } from "./model";
import { Icon } from "./widgets";
import { useModel, useWorkspace } from "./workspace";

export interface Command {
  label: string;
  icon: string;
  hint?: string;
  shortcut?: string;
  run(): void;
}

const GO: Kind[] = ["Language", "Entity", "Relationship", "Interaction", "Formula", "Domain", "Transformation", "Mediation"];

export function Palette({ commands, close }: { commands: Command[]; close(): void }) {
  const w = useWorkspace();
  const model = useModel();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const entries = useMemo<Command[]>(() => {
    const places: Command[] = [];
    for (const [id, at] of model.byId) {
      if (!GO.includes(at.kind)) continue;
      const where = "language" in at ? at.language.name : "domain" in at && at.kind === "Transformation" ? at.domain.name : undefined;
      places.push({ label: model.name(id), icon: at.kind, hint: where ? `${at.kind} in ${where}` : at.kind, run: () => w.reveal(id) });
    }
    return [...commands, ...places];
  }, [commands, model, w]);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return entries.slice(0, 60);
    return entries
      .map((e) => ({ e, text: `${e.label} ${e.hint ?? ""}`.toLowerCase() }))
      .filter(({ text }) => words.every((word) => text.includes(word)))
      .sort((a, b) => Number(!a.e.label.toLowerCase().startsWith(words[0]!)) - Number(!b.e.label.toLowerCase().startsWith(words[0]!)))
      .slice(0, 60)
      .map(({ e }) => e);
  }, [entries, query]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    close();
    command.run();
  };

  return (
    <div className="backdrop" onMouseDown={close}>
      <div className="palette" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" />
          <input
            autoFocus
            placeholder="Go to anything, or type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setIndex((i) => Math.min(i + 1, shown.length - 1)));
              if (e.key === "ArrowUp") (e.preventDefault(), setIndex((i) => Math.max(i - 1, 0)));
              if (e.key === "Enter") run(shown[index]);
              if (e.key === "Escape") close();
            }}
          />
        </div>
        <ul ref={list} className="palette-list" role="listbox">
          {shown.map((c, i) => (
            <li key={`${c.label}/${c.hint}/${i}`} role="option" aria-selected={i === index} className={i === index ? "on" : ""} onMouseEnter={() => setIndex(i)} onClick={() => run(c)}>
              <Icon name={c.icon} size={15} />
              <span className="palette-label">{c.label}</span>
              {c.hint && <span className="palette-hint">{c.hint}</span>}
              {c.shortcut && <kbd>{c.shortcut}</kbd>}
            </li>
          ))}
          {shown.length === 0 && <li className="muted">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}
