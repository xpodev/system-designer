/** Small building blocks the editors share. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ranges } from "./model";

const PATHS: Record<string, string> = {
  System: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z",
  Language: "M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6",
  Entity: "M5 6h14v12H5zM5 10h14",
  Relationship: "M7 12h10M4 9a3 3 0 1 0 0 6M20 9a3 3 0 1 1 0 6",
  End: "M5 12h10m-4-4 4 4-4 4",
  Interaction: "M13 3 5 14h6l-1 7 8-11h-6z",
  Parameter: "M8 8h8M8 12h8M8 16h5",
  Formula: "M17 5H7l6 7-6 7h10",
  Domain: "M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5",
  Transformation: "M4 12h14m-4-5 5 5-5 5",
  Mediation: "M4 7h16M4 12h16M4 17h16",
  view: "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9-2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  specification: "M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  save: "M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6",
  check: "M5 12.5 10 17l9-10",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  chevron: "m9 6 6 6-6 6",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  x: "M6 6l12 12M18 6 6 18",
  star: "m12 4 2.4 5 5.5.7-4 3.8 1 5.5-4.9-2.7-4.9 2.7 1-5.5-4-3.8 5.5-.7z",
  error: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5v5m0 3h.01",
  warning: "M12 4 21 20H3zM12 10v4m0 3h.01",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  diagram: "M4 4h6v6H4zM14 14h6v6h-6zM10 7h4a3 3 0 0 1 3 3v4",
  table: "M4 5h16v14H4zM4 10h16M4 15h16M10 5v14",
  catalog: "M4 5h6v14H4zM14 5h6v14h-6zM4 9h6M14 9h6",
  play: "M7 4v16l13-8z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  open: "M4 6h6l2 2h8v11H4z",
  keyboard: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8",
};

export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] ?? PATHS.Entity} />
    </svg>
  );
}

export function IconButton(props: { icon: string; label: string; onClick(): void; disabled?: boolean; className?: string; shortcut?: string }) {
  return (
    <button
      className={`icon-button ${props.className ?? ""}`}
      aria-label={props.label}
      title={props.shortcut ? `${props.label} (${props.shortcut})` : props.label}
      disabled={props.disabled}
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
    >
      <Icon name={props.icon} />
    </button>
  );
}

/** Text that reads as text and edits in place: click (or F2 on its row) to edit, Enter to keep, Escape to cancel. */
export function InlineText(props: {
  value: string;
  onCommit(value: string): unknown;
  placeholder?: string;
  className?: string;
  mono?: boolean;
  multiline?: boolean;
  editing?: boolean;
  onEditingChange?(editing: boolean): void;
  validate?(value: string): string | undefined;
}) {
  const [editing, setEditing] = useState(props.editing ?? false);
  const [draft, setDraft] = useState(props.value);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (props.editing) start();
  }, [props.editing]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);
  const start = () => {
    setDraft(props.value);
    setEditing(true);
    props.onEditingChange?.(true);
  };
  const stop = (keep: boolean) => {
    setEditing(false);
    props.onEditingChange?.(false);
    const value = draft.trim();
    if (keep && value !== "" && value !== props.value && !props.validate?.(value)) props.onCommit(value);
  };
  const problem = editing ? props.validate?.(draft.trim()) : undefined;
  if (!editing) {
    return (
      <span
        className={`inline-text ${props.mono ? "mono" : ""} ${props.className ?? ""} ${props.value ? "" : "placeholder"}`}
        tabIndex={0}
        role="button"
        title="Click to edit"
        onClick={(event) => {
          event.stopPropagation();
          start();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "F2") {
            event.preventDefault();
            start();
          }
        }}
      >
        {props.value || props.placeholder}
      </span>
    );
  }
  const shared = {
    ref: input,
    className: `inline-input ${props.mono ? "mono" : ""} ${problem ? "invalid" : ""} ${props.className ?? ""}`,
    value: draft,
    placeholder: props.placeholder,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: () => stop(true),
    onClick: (event: { stopPropagation(): void }) => event.stopPropagation(),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !(props.multiline && event.shiftKey)) {
        event.preventDefault();
        stop(true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        stop(false);
      }
    },
    title: problem,
  };
  return props.multiline ? <textarea rows={2} {...shared} /> : <input {...shared} size={Math.max(4, draft.length + 1)} />;
}

/** Creates something from a name typed in place: the button becomes an input. */
export function AddInline(props: { label: string; placeholder: string; onAdd(name: string): unknown; mono?: boolean }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open)
    return (
      <button className="add-inline" onClick={() => setOpen(true)}>
        <Icon name="plus" /> {props.label}
      </button>
    );
  const done = (keep: boolean) => {
    if (keep && value.trim()) props.onAdd(value.trim());
    setValue("");
    setOpen(false);
  };
  return (
    <input
      autoFocus
      className={`add-input ${props.mono ? "mono" : ""}`}
      placeholder={props.placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (value.trim()) props.onAdd(value.trim());
          setValue("");
        }
        if (e.key === "Escape") done(false);
      }}
    />
  );
}

/** A range: the usual ones at a click, any other typed. */
export function RangePicker(props: { value: string; onChange(value: string): void; invalid?: boolean }) {
  const [custom, setCustom] = useState(false);
  if (custom || !(ranges as readonly string[]).includes(props.value)) {
    return (
      <InlineText
        value={props.value}
        mono
        className={`range ${props.invalid ? "invalid-value" : ""}`}
        editing={custom}
        onEditingChange={(editing) => !editing && setCustom(false)}
        validate={(v) => (/^\d+\.\.(\d+|N)$/.test(v) ? undefined : "a range: min..max, with N for many")}
        onCommit={props.onChange}
      />
    );
  }
  return (
    <select
      className={`range-select mono ${props.invalid ? "invalid-value" : ""}`}
      value={props.value}
      onChange={(e) => (e.target.value === "custom" ? setCustom(true) : props.onChange(e.target.value))}
      onClick={(e) => e.stopPropagation()}
      title="How many: min..max"
    >
      {ranges.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
      <option value="custom">other…</option>
    </select>
  );
}

export interface Choice {
  id: string;
  label: string;
  hint?: string;
}

/** Picks one of `choices`; shows itself as its current choice. */
export function Picker(props: { value?: string; choices: Choice[]; onChange(id: string | undefined): void; placeholder?: string; allowNone?: boolean; className?: string; invalid?: boolean }) {
  return (
    <select
      className={`picker ${props.className ?? ""} ${props.invalid ? "invalid-value" : ""} ${props.value ? "" : "empty-choice"}`}
      value={props.value ?? ""}
      onChange={(e) => props.onChange(e.target.value || undefined)}
      onClick={(e) => e.stopPropagation()}
    >
      {(props.allowNone || !props.value) && <option value="">{props.placeholder ?? "—"}</option>}
      {props.value && !props.choices.some((c) => c.id === props.value) && <option value={props.value}>{props.value} (elsewhere)</option>}
      {props.choices.map((c) => (
        <option key={c.id} value={c.id}>
          {c.hint ? `${c.label} — ${c.hint}` : c.label}
        </option>
      ))}
    </select>
  );
}

/** A set of chosen things, as chips, each removable, with a picker for more. */
export function Chips(props: {
  values: string[];
  label(id: string): string;
  choices: Choice[];
  onAdd(id: string): void;
  onRemove(id: string): void;
  onOpen?(id: string): void;
  addLabel: string;
  icon?: string;
  empty?: string;
}) {
  const rest = props.choices.filter((c) => !props.values.includes(c.id));
  return (
    <div className="chips">
      {props.values.length === 0 && props.empty && <span className="muted">{props.empty}</span>}
      {props.values.map((id) => (
        <span key={id} className="chip">
          {props.icon && <Icon name={props.icon} size={13} />}
          <button className="chip-label" onClick={() => props.onOpen?.(id)} disabled={!props.onOpen}>
            {props.label(id)}
          </button>
          <button className="chip-remove" aria-label={`Remove ${props.label(id)}`} onClick={() => props.onRemove(id)}>
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      {rest.length > 0 && (
        <select className="chip-add" value="" onChange={(e) => e.target.value && props.onAdd(e.target.value)} aria-label={props.addLabel}>
          <option value="">+ {props.addLabel}</option>
          {rest.map((c) => (
            <option key={c.id} value={c.id}>
              {c.hint ? `${c.label} — ${c.hint}` : c.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export interface MenuItem {
  label: string;
  icon?: string;
  danger?: boolean;
  shortcut?: string;
  onSelect(): void;
}

/** A "more" button that opens a small menu. */
export function Menu(props: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => !root.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="menu-root" ref={root}>
      <IconButton icon="more" label={props.label ?? "More"} onClick={() => setOpen(!open)} />
      {open && <MenuList items={props.items} close={() => setOpen(false)} />}
    </div>
  );
}

export function MenuList({ items, close, style }: { items: MenuItem[]; close(): void; style?: React.CSSProperties }) {
  return (
    <ul className="menu" role="menu" style={style} onClick={(e) => e.stopPropagation()}>
      {items.map((item) => (
        <li key={item.label}>
          <button
            role="menuitem"
            className={item.danger ? "danger" : ""}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            {item.icon && <Icon name={item.icon} size={14} />}
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut}</kbd>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Section(props: { title: string; count?: number; actions?: ReactNode; children: ReactNode; icon?: string; id?: string; hint?: string }) {
  return (
    <section className="editor-section" id={props.id}>
      <header>
        <h3>
          {props.icon && <Icon name={props.icon} />}
          {props.title}
          {props.count !== undefined && <span className="count">{props.count}</span>}
        </h3>
        {props.hint && <span className="section-hint">{props.hint}</span>}
        <div className="section-actions">{props.actions}</div>
      </header>
      {props.children}
    </section>
  );
}

export function Badge({ severity, children }: { severity: "error" | "warning" | "ok" | "info"; children: ReactNode }) {
  return <span className={`badge ${severity}`}>{children}</span>;
}

/** Small marks beside something that has Diagnostics. */
export function Marks({ diagnostics }: { diagnostics: { severity: string; check: string; message: string }[] }) {
  if (diagnostics.length === 0) return null;
  const errors = diagnostics.filter((d) => d.severity === "error");
  return (
    <span className={`marks ${errors.length ? "error" : "warning"}`} title={diagnostics.map((d) => `${d.check}: ${d.message}`).join("\n")}>
      <Icon name={errors.length ? "error" : "warning"} size={14} />
    </span>
  );
}

/**
 * A handle between two panes, dragged to resize one of them. `size` is that pane's size along
 * `axis`; `grows` says whether dragging right (or down) makes it bigger or smaller. Double-click
 * puts it back to `initial`.
 */
export function Splitter(props: {
  axis: "x" | "y";
  size: number;
  grows: "with" | "against";
  min: number;
  max: number;
  initial: number;
  onResize(size: number): void;
  onResized(size: number): void;
  label: string;
}) {
  const start = useRef<{ at: number; size: number; last: number }>(undefined);
  const clamp = (n: number) => Math.min(props.max, Math.max(props.min, n));
  const at = (event: React.PointerEvent) => (props.axis === "x" ? event.clientX : event.clientY);
  return (
    <div
      className={`splitter ${props.axis}`}
      role="separator"
      aria-orientation={props.axis === "x" ? "vertical" : "horizontal"}
      aria-label={props.label}
      aria-valuenow={Math.round(props.size)}
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      tabIndex={0}
      title={`${props.label}: drag to resize, double-click to reset`}
      onPointerDown={(event) => {
        (event.target as Element).setPointerCapture(event.pointerId);
        start.current = { at: at(event), size: props.size, last: props.size };
        document.body.classList.add(props.axis === "x" ? "resizing-x" : "resizing-y");
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        const delta = at(event) - start.current.at;
        const size = clamp(start.current.size + (props.grows === "with" ? delta : -delta));
        start.current.last = size;
        props.onResize(size);
      }}
      onPointerUp={() => {
        if (!start.current) return;
        props.onResized(start.current.last);
        start.current = undefined;
        document.body.classList.remove("resizing-x", "resizing-y");
      }}
      onDoubleClick={() => props.onResized(props.initial)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 48 : 16;
        const forward = props.axis === "x" ? "ArrowRight" : "ArrowDown";
        const back = props.axis === "x" ? "ArrowLeft" : "ArrowUp";
        if (event.key !== forward && event.key !== back) return;
        event.preventDefault();
        const towards = (event.key === forward ? 1 : -1) * (props.grows === "with" ? 1 : -1);
        props.onResized(clamp(props.size + towards * step));
      }}
    />
  );
}
