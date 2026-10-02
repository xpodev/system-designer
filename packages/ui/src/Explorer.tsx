/**
 * The Explorer: the whole System as a tree. A click opens what it is in its editor; each node
 * offers what can be added to it, and its context menu what can be done with it.
 */
import { useMemo, useState, type ReactNode } from "react";
import { tabKey, type Tab } from "./model";
import { Icon, MenuList, type MenuItem } from "./widgets";
import { useWorkspace } from "./workspace";

interface Node {
  id: string;
  label: string;
  icon: string;
  tab?: Tab;
  /** The id whose Diagnostics mark this node. */
  subject?: string;
  detail?: string;
  children?: Node[];
  add?: { label: string; run(): void }[];
  menu?: MenuItem[];
}

export function Explorer() {
  const w = useWorkspace();
  const model = w.model!;
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] }>();
  /** Ids toggled from how they start. */
  const collapsed = new Set(w.layout.collapsed ?? []);
  const toggle = (id: string) =>
    w.setLayout((l) => {
      const set = new Set(l.collapsed ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...l, collapsed: [...set] };
    });

  const nodes = useMemo<Node[]>(() => {
    const system = model.system.id;
    const remove = (editor: string, arg: string, id: string, what: string): MenuItem => ({
      label: `Delete ${what}`,
      icon: "trash",
      danger: true,
      onSelect: () => void w.act(editor, "remove", { [arg]: id }, { message: `Deleted ${what} ${model.name(id)}` }),
    });
    const languages: Node = {
      id: "#languages",
      label: "Languages",
      icon: "Language",
      add: [{ label: "Language", run: () => void addNamed("SystemEditor", "addLanguage", { system }, "Language") }],
      children: model.languages.map((l) => ({
        id: l.id,
        label: l.name,
        icon: "Language",
        tab: { kind: "language", id: l.id },
        subject: l.id,
        add: [{ label: "Entity", run: () => void addNamed("LanguageEditor", "addEntity", { language: l.id }, "Entity", l.id) }],
        menu: [
          { label: "Open", icon: "open", onSelect: () => w.open({ kind: "language", id: l.id }) },
          { label: "Add Entity", icon: "Entity", onSelect: () => void addNamed("LanguageEditor", "addEntity", { language: l.id }, "Entity", l.id) },
          remove("LanguageEditor", "language", l.id, "Language"),
        ],
        children: [
          ...l.entities.map((e) => ({ id: e.id, label: e.name, icon: "Entity", subject: e.id })),
          ...l.relationships.map((r) => ({ id: r.id, label: model.name(r.id), icon: "Relationship", subject: r.id })),
          ...l.interactions.map((i) => ({ id: i.id, label: `${i.name}()`, icon: "Interaction", subject: i.id })),
          ...l.formulas.map((f) => ({ id: f.id, label: f.text, icon: "Formula", subject: f.id })),
        ],
      })),
    };
    const domains: Node = {
      id: "#domains",
      label: "Domains",
      icon: "Domain",
      add: [{ label: "Domain", run: () => void addNamed("SystemEditor", "addDomain", { system }, "Domain") }],
      children: model.domains.map((d) => ({
        id: d.id,
        label: d.name,
        icon: "Domain",
        tab: { kind: "domain", id: d.id },
        subject: d.id,
        detail: model.rolesOf(d.id).some((r) => r.role === "mediator") ? "mediator" : undefined,
        menu: [{ label: "Open", icon: "open", onSelect: () => w.open({ kind: "domain", id: d.id }) }, remove("DomainEditor", "domain", d.id, "Domain")],
        children: d.transformations.map((t) => ({
          id: t.id,
          label: t.name,
          icon: "Transformation",
          tab: { kind: "transformation", id: t.id },
          subject: t.id,
          detail: `${model.name(t.source)} → ${model.name(t.target)}`,
          menu: [{ label: "Open", icon: "open", onSelect: () => w.open({ kind: "transformation", id: t.id }) }, remove("TransformationEditor", "transformation", t.id, "Transformation")],
        })),
      })),
    };
    const mediations: Node = {
      id: "#mediations",
      label: "Mediations",
      icon: "Mediation",
      add: model.domains.length >= 2 ? [{ label: "Mediation", run: () => w.open({ kind: "system" }, "#new-mediation") }] : [],
      children: model.mediations.map((m) => ({
        id: m.id,
        label: model.name(m.id),
        icon: "Mediation",
        tab: { kind: "mediation", id: m.id },
        subject: m.id,
        detail: `by ${model.name(m.mediator)}`,
        menu: [{ label: "Open", icon: "open", onSelect: () => w.open({ kind: "mediation", id: m.id }) }, remove("MediationEditor", "mediation", m.id, "Mediation")],
      })),
    };
    return [languages, domains, mediations];

    async function addNamed(editor: string, operation: string, args: Record<string, unknown>, what: string, parent?: string) {
      const name = uniqueName(what, model.languages.flatMap((l) => [l.name, ...l.entities.map((e) => e.name)]).concat(model.domains.map((d) => d.name)));
      const edit = await w.act(editor, operation, { ...args, name });
      const id = edit?.elements[0];
      if (!id) return;
      if (parent) w.setLayout((l) => ({ ...l, collapsed: [...new Set([...(l.collapsed ?? []), parent])] }));
      w.reveal(id);
    }
  }, [model, w]);

  const matches = (node: Node): boolean => !filter || node.label.toLowerCase().includes(filter.toLowerCase()) || (node.children ?? []).some(matches);
  const activeKey = w.active;

  const row = (node: Node, depth: number): ReactNode => {
    if (!matches(node)) return null;
    const isGroup = node.id.startsWith("#");
    // Groups start open and everything else closed; a toggle flips that.
    const open = filter ? true : isGroup ? !collapsed.has(node.id) : collapsed.has(node.id);
    const hasChildren = (node.children ?? []).length > 0;
    const diagnostics = node.subject ? w.about(node.subject) : [];
    const own = diagnostics.some((d) => d.severity === "error") ? "error" : diagnostics.length ? "warning" : "";
    const nested = node.children ? countMarks(node.children, w.about) : 0;
    const selected = node.tab ? tabKey(node.tab) === activeKey : false;
    const activate = () => {
      if (node.tab) w.open(node.tab);
      else if (node.subject) w.reveal(node.subject);
      else toggle(node.id);
    };
    return (
      <li key={node.id}>
        <div
          className={`tree-row ${isGroup ? "group" : ""} ${selected ? "selected" : ""}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          tabIndex={0}
          onClick={activate}
          onKeyDown={(e) => {
            if (e.key === "Enter") activate();
            if ((e.key === "ArrowRight" && !open) || (e.key === "ArrowLeft" && open)) if (hasChildren) toggle(node.id);
          }}
          onContextMenu={(e) => {
            if (!node.menu) return;
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, items: node.menu });
          }}
        >
          <button
            className={`twisty ${hasChildren ? "" : "hidden"}`}
            tabIndex={-1}
            aria-label={open ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.id);
            }}
          >
            <Icon name={open && hasChildren ? "down" : "chevron"} size={12} />
          </button>
          <Icon name={node.icon} size={15} className={`kind-icon ${node.icon}`} />
          <span className="tree-label">{node.label}</span>
          {node.detail && <span className="tree-detail">{node.detail}</span>}
          {own && <span className={`dot ${own}`} title={diagnostics.map((d) => d.message).join("\n")} />}
          {!own && nested > 0 && !open && <span className="dot nested" title={`${nested} problem(s) inside`} />}
          <span className="row-actions">
            {node.add?.map((a) => (
              <button
                key={a.label}
                className="row-add"
                title={`Add ${a.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  a.run();
                }}
              >
                <Icon name="plus" size={13} />
              </button>
            ))}
          </span>
        </div>
        {open && hasChildren && <ul>{node.children!.map((child) => row(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="explorer">
      <div className="explorer-search">
        <Icon name="search" size={14} />
        <input placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter the explorer" />
      </div>
      <button className={`tree-row system-row ${activeKey === "system" ? "selected" : ""}`} onClick={() => w.open({ kind: "system" })}>
        <Icon name="System" size={15} />
        <span className="tree-label">{model.system.name}</span>
      </button>
      <ul className="tree">{nodes.map((n) => row(n, 0))}</ul>
      <h4 className="explorer-heading">Views</h4>
      <ul className="tree">
        {[
          ["domain-map", "Domain map", "diagram"],
          ["mediation-stack", "Mediation stack", "Mediation"],
          ["levels", "Levels", "table"],
          ["statistics", "Statistics", "table"],
        ].map(([perspective, label, icon]) => (
          <li key={perspective}>
            <div className={`tree-row ${activeKey === `view:${perspective}` ? "selected" : ""}`} style={{ paddingLeft: 20 }} onClick={() => w.open({ kind: "view", perspective: perspective! })}>
              <Icon name={icon!} size={15} />
              <span className="tree-label">{label}</span>
            </div>
          </li>
        ))}
        <li>
          <div className={`tree-row ${activeKey === "script" ? "selected" : ""}`} style={{ paddingLeft: 20 }} onClick={() => w.open({ kind: "script" })}>
            <Icon name="play" size={15} />
            <span className="tree-label">Verification script</span>
          </div>
        </li>
        <li>
          <div className={`tree-row ${activeKey === "specification" ? "selected" : ""}`} style={{ paddingLeft: 20 }} onClick={() => w.open({ kind: "specification" })}>
            <Icon name="specification" size={15} />
            <span className="tree-label">Specification</span>
          </div>
        </li>
      </ul>
      {menu && (
        <div className="context-backdrop" onClick={() => setMenu(undefined)} onContextMenu={(e) => (e.preventDefault(), setMenu(undefined))}>
          <MenuList items={menu.items} close={() => setMenu(undefined)} style={{ position: "fixed", left: menu.x, top: menu.y }} />
        </div>
      )}
    </div>
  );
}

function countMarks(nodes: Node[], about: (id: string) => unknown[]): number {
  return nodes.reduce((sum, n) => sum + (n.subject ? about(n.subject).length : 0) + countMarks(n.children ?? [], about), 0);
}

/** `New Entity`, `New Entity 2`, … whichever is free. */
export function uniqueName(what: string, taken: readonly string[]): string {
  const base = `New${what}`;
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) if (!taken.includes(`${base}${n}`)) return `${base}${n}`;
}
