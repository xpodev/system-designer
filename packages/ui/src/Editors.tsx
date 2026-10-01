/**
 * One panel per concept editor (the XPanel mediations), each a form per operation, generated
 * from the operation's descriptor. The operations that act on what is selected come first.
 */
import { useEffect, useState } from "react";
import type { OperationInfo } from "./api";

/** The Elements a form may choose from, by Entity. */
export type Elements = Map<string, { id: string; label: string }[]>;

export function Editors(props: {
  operations: OperationInfo[];
  elements: Elements;
  selected?: { id: string; kind: string };
  onRun(operation: OperationInfo, args: Record<string, unknown>): Promise<void>;
}) {
  const { operations, elements, selected, onRun } = props;
  const [open, setOpen] = useState<string | undefined>();
  const key = (op: OperationInfo) => `${op.editor}.${op.name}`;
  const fits = (op: OperationInfo) => selected !== undefined && op.parameters[0]?.kind === "element" && (op.parameters[0].of ?? []).includes(selected.kind);
  const relevant = operations.filter(fits);
  const editors = [...new Set(operations.map((op) => op.editor))];

  const entry = (op: OperationInfo) => (
    <div key={key(op)} className={`operation ${open === key(op) ? "open" : ""}`}>
      <button className="operation-name" onClick={() => setOpen(open === key(op) ? undefined : key(op))} title={op.about}>
        <span className={`op-kind ${op.kind}`} />
        {op.name}
      </button>
      {open === key(op) && <Form operation={op} elements={elements} selected={selected} onRun={onRun} />}
    </div>
  );

  return (
    <div className="editors">
      {relevant.length > 0 && (
        <section>
          <h3>For the selection</h3>
          {relevant.map(entry)}
        </section>
      )}
      {editors.map((editor) => (
        <details key={editor}>
          <summary>{editor}</summary>
          {operations.filter((op) => op.editor === editor).map(entry)}
        </details>
      ))}
    </div>
  );
}

function Form(props: { operation: OperationInfo; elements: Elements; selected?: { id: string; kind: string }; onRun(op: OperationInfo, args: Record<string, unknown>): Promise<void> }) {
  const { operation, elements, selected, onRun } = props;
  const initial = () => {
    const values: Record<string, unknown> = {};
    for (const p of operation.parameters) {
      if (p.kind === "element" && selected && (p.of ?? []).includes(selected.kind)) values[p.name] = selected.id;
      if (p.kind === "elements") values[p.name] = [];
      if (p.kind === "flag") values[p.name] = false;
    }
    return values;
  };
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(initial()), [operation, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));
  const options = (of: readonly string[] = []) => of.flatMap((kind) => elements.get(kind) ?? []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const args = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined));
    try {
      await onRun(operation, args);
      setValues(initial());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <p className="about">{operation.about}</p>
      {operation.parameters.map((p) => (
        <label key={p.name}>
          <span>
            {p.name}
            {p.optional ? " (optional)" : ""}
          </span>
          {p.kind === "element" && (
            <select value={String(values[p.name] ?? "")} onChange={(e) => set(p.name, e.target.value || undefined)} required={!p.optional}>
              <option value="">{p.about}…</option>
              {options(p.of).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {p.kind === "elements" && (
            <select
              multiple
              size={Math.min(6, Math.max(2, options(p.of).length))}
              value={(values[p.name] as string[]) ?? []}
              onChange={(e) => set(p.name, [...e.target.selectedOptions].map((o) => o.value))}
            >
              {options(p.of).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {(p.kind === "text" || p.kind === "range") && (
            <input
              value={String(values[p.name] ?? "")}
              onChange={(e) => set(p.name, e.target.value)}
              placeholder={p.kind === "range" ? "0..1, 1..N" : p.about}
              required={!p.optional}
              pattern={p.kind === "range" ? "\\d+\\.\\.(\\d+|N)" : undefined}
            />
          )}
          {p.kind === "index" && (
            <input type="number" min={0} value={values[p.name] === undefined ? "" : String(values[p.name])} onChange={(e) => set(p.name, e.target.value === "" ? undefined : Number(e.target.value))} required={!p.optional} />
          )}
          {p.kind === "flag" && <input type="checkbox" checked={Boolean(values[p.name])} onChange={(e) => set(p.name, e.target.checked)} />}
        </label>
      ))}
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>
        {operation.name}
      </button>
    </form>
  );
}
