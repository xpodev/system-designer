/** What every editor has: a header naming what is edited, and its problems where they can be fixed. */
import type { ReactNode } from "react";
import { Icon, InlineText } from "../widgets";
import { useModel, useWorkspace } from "../workspace";

export function EditorHeader(props: { icon: string; kind: string; id: string; name: string; onRename?(name: string): void; summary?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="editor-header">
      <div className={`editor-icon ${props.icon}`}>
        <Icon name={props.icon} size={22} />
      </div>
      <div className="editor-title">
        <span className="editor-kind">{props.kind}</span>
        <h1>{props.onRename ? <InlineText value={props.name} onCommit={props.onRename} /> : props.name}</h1>
        {props.summary && <span className="editor-summary">{props.summary}</span>}
      </div>
      <div className="editor-actions">{props.actions}</div>
    </header>
  );
}

/** The Diagnostics about these ids, with what to do about them; their subjects open where they are edited. */
export function Problems({ ids }: { ids: string[] }) {
  const w = useWorkspace();
  const model = useModel();
  const seen = new Set<string>();
  const found = ids.flatMap((id) => w.about(id)).filter((d) => {
    const key = `${d.check}|${d.message}|${d.subjects.join()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (found.length === 0) return null;
  return (
    <ul className="problems-inline">
      {found.map((d, i) => (
        <li key={i} className={d.severity}>
          <Icon name={d.severity === "error" ? "error" : "warning"} size={15} />
          <div>
            <span className="problem-message">{d.message}</span>
            <span className="problem-check">{d.kind === "rule" ? `rule ${d.check}` : d.check}</span>
            {d.suggestions.map((s, j) => (
              <span key={j} className="problem-fix">
                {s.message}
              </span>
            ))}
            <span className="problem-subjects">
              {d.subjects
                .filter((s) => model.get(s))
                .map((s) => (
                  <button key={s} className="link-chip" onClick={() => w.reveal(s)}>
                    {model.name(s)}
                  </button>
                ))}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
