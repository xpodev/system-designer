/** A point of view on the System, drawn: graphs for maps and stacks, outlines for the rest. A click opens what was clicked. */
import { useEffect, useState, type ReactNode } from "react";
import { api, type View } from "./api";
import { Graph } from "./Graph";
import { Tree } from "./Tree";
import { Icon } from "./widgets";
import { useWorkspace } from "./workspace";

const GRAPHS = new Set(["domain-map", "mediation-stack"]);
const ABOUT: Record<string, string> = {
  "domain-map": "Domains, the Languages they use (dashed), the Domains they reference, and the Transformations between Languages: projections in green, mediations in blue.",
  "mediation-stack": "Each Domain above the Domains it is carried out over; each arrow is a Mediation, labelled with its mediator.",
  levels: "The kernel, the Systemathic Languages built in it, and your model, made of them.",
  statistics: "Counts, depths, fan-in and fan-out.",
};

export function ViewTab({ perspective }: { perspective: string }) {
  const w = useWorkspace();
  const [view, setView] = useState<View>();
  const [error, setError] = useState<string>();
  const [collapsed, setCollapsed] = useState(new Set<string>());
  useEffect(() => {
    void api.view(w.context, perspective).then(setView, (e) => setError(e.message));
  }, [w.context, perspective, w.version]);
  if (error) return <p className="empty">{error}</p>;
  if (!view) return <p className="empty">Loading…</p>;
  const key = `view/${perspective}`;
  return (
    <div className="editor">
      <header className="editor-header compact">
        <div className="editor-icon view">
          <Icon name={GRAPHS.has(perspective) ? "diagram" : "table"} size={22} />
        </div>
        <div className="editor-title">
          <span className="editor-kind">View</span>
          <h1>{view.title}</h1>
          <span className="editor-summary">{ABOUT[perspective]}</span>
        </div>
      </header>
      <div className="editor-body view-body">
        {GRAPHS.has(perspective) ? (
          <Graph
            view={view}
            saved={w.layout.positions?.[key] ?? {}}
            onSelect={(subject) => w.reveal(subject)}
            onMove={(positions) => w.setLayout((l) => ({ ...l, positions: { ...l.positions, [key]: positions } }))}
          />
        ) : (
          <Tree
            view={view}
            collapsed={collapsed}
            onToggle={(id) =>
              setCollapsed((c) => {
                const next = new Set(c);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onSelect={(subject) => w.model?.get(subject) && w.model.kind(subject) !== "System" && w.reveal(subject)}
          />
        )}
      </div>
    </div>
  );
}

/** The Specification: the contract an implementer satisfies, read as a document. */
export function SpecificationTab() {
  const w = useWorkspace();
  const [markdown, setMarkdown] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    setError(undefined);
    void api.specification(w.context).then(
      (s) => setMarkdown(s.markdown),
      (e) => setError(e.message),
    );
  }, [w.context, w.version]);
  return (
    <div className="editor">
      <header className="editor-header compact">
        <div className="editor-icon view">
          <Icon name="specification" size={22} />
        </div>
        <div className="editor-title">
          <span className="editor-kind">Export</span>
          <h1>Specification</h1>
          <span className="editor-summary">What an implementation may contain, and what it must satisfy — for a person, or an LLM.</span>
        </div>
        <div className="editor-actions">
          <button disabled={!markdown} onClick={() => markdown && void navigator.clipboard.writeText(markdown).then(() => w.notify("Copied the Markdown", "ok"))}>
            Copy Markdown
          </button>
        </div>
      </header>
      <div className="editor-body">
        {error ? (
          <p className="inline-problem error">{error}</p>
        ) : markdown === undefined ? (
          <p className="empty">Loading…</p>
        ) : (
          <article className="document">{render(markdown)}</article>
        )}
      </div>
    </div>
  );
}

/** Enough Markdown for a specification: headings and items, with their ids as small tags. */
function render(markdown: string): ReactNode[] {
  const out: ReactNode[] = [];
  let items: ReactNode[] = [];
  const flush = () => {
    if (items.length) out.push(<ul key={out.length}>{items}</ul>);
    items = [];
  };
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^(#{1,4}) (.*?)(?: \{#[^}]+\})?$/);
    const item = line.match(/^- \[([^\]]+)\] (.*?)(?: <!--.*-->)?$/);
    if (heading) {
      flush();
      const Tag = `h${Math.min(heading[1]!.length + 1, 5)}` as "h2";
      out.push(<Tag key={out.length}>{heading[2]}</Tag>);
    } else if (item) {
      items.push(
        <li key={items.length}>
          <code className="spec-id">{item[1]}</code> <span dangerouslySetInnerHTML={{ __html: inline(item[2]!) }} />
        </li>,
      );
    } else if (line.trim()) {
      flush();
      out.push(<p key={out.length}>{line}</p>);
    }
  }
  flush();
  return out;
}

function inline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
