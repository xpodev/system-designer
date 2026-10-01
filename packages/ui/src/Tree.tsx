/** Rendering a View as an outline: Items under their parents, with their Marks. */
import type { Item, View } from "./api";

export function Tree(props: { view: View; selected?: string; collapsed: Set<string>; onToggle(id: string): void; onSelect(subject: string): void }) {
  const { view, selected, collapsed, onToggle, onSelect } = props;
  const byId = new Map(view.items.map((item) => [item.id, item]));
  const roots = view.items.filter((item) => item.parent === undefined);
  const row = (item: Item, depth: number) => {
    const open = !collapsed.has(item.id);
    const errors = item.marks.filter((m) => m.severity === "error").length;
    const warnings = item.marks.length - errors;
    return (
      <li key={item.id}>
        <div
          className={`row ${item.kind} ${selected === item.subject && item.kind !== "group" ? "selected" : ""}`}
          style={{ paddingLeft: 8 + depth * 16 }}
          onClick={() => onSelect(item.subject)}
          title={item.marks.map((m) => `${m.check}: ${m.message}`).join("\n")}
        >
          {item.children.length > 0 ? (
            <button
              className="twisty"
              aria-label={open ? "Collapse" : "Expand"}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(item.id);
              }}
            >
              {open ? "▾" : "▸"}
            </button>
          ) : (
            <span className="twisty" />
          )}
          <span className="kind">{item.kind}</span>
          <span className="label">{item.label}</span>
          {item.detail && <span className="detail">{item.detail}</span>}
          {errors > 0 && <span className="badge error">{errors}</span>}
          {warnings > 0 && <span className="badge warning">{warnings}</span>}
        </div>
        {open && item.children.length > 0 && <ul>{item.children.map((child) => row(byId.get(child)!, depth + 1))}</ul>}
      </li>
    );
  };
  if (roots.length === 0) return <p className="empty">Nothing to show yet.</p>;
  return <ul className="tree">{roots.map((item) => row(item, 0))}</ul>;
}
