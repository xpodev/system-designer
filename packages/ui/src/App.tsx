/**
 * The UI: a client of the host, with its own EditSession on each system context it shows.
 * What it draws comes from Views; what it changes goes through the editors' operations; what
 * other clients change arrives as events. Its layout — the perspective, what is collapsed,
 * where boxes were dragged — is kept with the System as the `ui` attachment.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type ContextInfo, type Diagnostic, type EditInfo, type OperationInfo, type PackageSummary, type PerspectiveInfo, type RunInfo, type View } from "./api";
import { Editors, type Elements } from "./Editors";
import { Graph, type Positions } from "./Graph";
import { Tree } from "./Tree";

const GRAPHS = new Set(["domain-map", "language", "mediation-stack"]);

interface Layout {
  perspective?: string;
  language?: string;
  collapsed?: string[];
  positions?: Record<string, Positions>;
}

type Dialog = { kind: "open" } | { kind: "new" } | { kind: "save" } | { kind: "catalog" } | { kind: "specification"; markdown: string };

export function App() {
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [context, setContext] = useState<string | undefined>();
  const [session, setSession] = useState<string | undefined>();
  const [operations, setOperations] = useState<OperationInfo[]>([]);
  const [perspectives, setPerspectives] = useState<PerspectiveInfo[]>([]);
  const [layout, setLayout] = useState<Layout>({});
  const [view, setView] = useState<View | undefined>();
  const [outline, setOutline] = useState<View | undefined>();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [history, setHistory] = useState<EditInfo[]>([]);
  const [run, setRun] = useState<RunInfo | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  const [tab, setTab] = useState<"diagnostics" | "history" | "verification">("diagnostics");
  const [dialog, setDialog] = useState<Dialog | undefined>();
  const [message, setMessage] = useState<{ text: string; error?: boolean } | undefined>();
  /** Our session on each context, started once even when React runs an effect twice. */
  const sessions = useRef(new Map<string, Promise<string>>());

  const perspective = layout.perspective ?? "outline";
  const languages = useMemo(() => outline?.items.filter((item) => item.kind === "Language") ?? [], [outline]);
  const language = layout.language ?? languages[0]?.subject;

  const notify = (text: string, error = false) => setMessage({ text, error });
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(undefined), message.error ? 8000 : 3000);
    return () => clearTimeout(timer);
  }, [message]);
  const failed = (error: unknown) => notify((error as Error).message, true);

  useEffect(() => {
    void Promise.all([api.editors(), api.perspectives(), api.contexts()]).then(([ops, ps, cs]) => {
      setOperations(ops);
      setPerspectives(ps);
      setContexts(cs);
      if (cs[0]) setContext(cs[0].id);
    }, failed);
  }, []);

  // A session of our own on the context we show, and its saved layout.
  useEffect(() => {
    if (!context) return;
    setSelected(undefined);
    setRun(undefined);
    let started = sessions.current.get(context);
    if (!started) {
      started = api.startSession(context).then(({ session }) => session);
      sessions.current.set(context, started);
    }
    void started.then(setSession, failed);
    void api.attachment(context, "ui").then((data) => setLayout((data as Layout | null) ?? {}), failed);
  }, [context]);

  const refresh = useCallback(async () => {
    if (!context) return;
    try {
      const [o, d, h, cs] = await Promise.all([api.view(context, "outline"), api.diagnostics(context), api.history(context), api.contexts()]);
      setOutline(o);
      setDiagnostics(d);
      setHistory(h);
      setContexts(cs);
      const needsLanguage = perspective === "language";
      const languageId = layout.language ?? o.items.find((item) => item.kind === "Language")?.subject;
      if (perspective === "outline") setView(o);
      else if (needsLanguage && !languageId) setView({ perspective, title: "Language", items: [], links: [] });
      else setView(await api.view(context, perspective, needsLanguage ? languageId : undefined));
    } catch (error) {
      failed(error);
    }
  }, [context, perspective, layout.language]);

  useEffect(() => void refresh(), [refresh]);

  // Every Edit, by any client, refreshes what is shown.
  useEffect(
    () =>
      api.events((event) => {
        if (event.type === "contexts") void api.contexts().then(setContexts);
        if ("context" in event && event.context === context) {
          if (event.type === "verified") setRun(event.run);
          void refresh();
        }
      }),
    [context, refresh],
  );

  const saveLayout = (next: Layout) => {
    setLayout(next);
    if (context) void api.setAttachment(context, "ui", next).catch(failed);
  };

  const elements: Elements = useMemo(() => {
    const index: Elements = new Map();
    for (const item of outline?.items ?? []) {
      if (item.kind === "group") continue;
      const label = item.kind === "End" ? (item.detail ?? item.label) : item.label;
      const list = index.get(item.kind) ?? [];
      if (!list.some((e) => e.id === item.subject)) list.push({ id: item.subject, label });
      index.set(item.kind, list);
    }
    return index;
  }, [outline]);

  const selectedItem = outline?.items.find((item) => item.subject === selected && item.kind !== "group");

  const select = (subject: string) => {
    setSelected(subject);
    if (context && session) void api.select(context, session, [subject]).catch(() => undefined);
  };

  const apply = async (op: OperationInfo, args: Record<string, unknown>) => {
    if (!context || !session) return;
    const edit = await api.apply(context, session, op.editor, op.name, args);
    if (edit.kind === "addition" && edit.elements[0]) setSelected(edit.elements[0]);
    notify(`${edit.summary}`);
  };

  const undo = async () => {
    if (!context || !session) return;
    const edit = await api.undo(context, session).catch(failed);
    notify(edit ? edit.summary : "Nothing of yours to undo");
  };

  const verify = async () => {
    if (!context) return;
    try {
      const result = await api.verify(context);
      setRun(result);
      setTab("verification");
      notify(`${result.profile}: ${result.errors} errors, ${result.warnings} warnings`, result.errors > 0);
    } catch (error) {
      failed(error);
      setTab("diagnostics");
    }
  };

  const specification = async () => {
    if (!context) return;
    try {
      setDialog({ kind: "specification", markdown: (await api.specification(context)).markdown });
    } catch (error) {
      failed(error);
    }
  };

  const current = contexts.find((c) => c.id === context);
  const structural = diagnostics.filter((d) => d.kind === "condition" && d.severity === "error").length;

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">Systemathic</strong>
        <select value={context ?? ""} onChange={(e) => setContext(e.target.value || undefined)} aria-label="System">
          {contexts.length === 0 && <option value="">No System open</option>}
          {contexts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.path ? ` — ${c.path.split(/[\\/]/).pop()}` : ""}
            </option>
          ))}
        </select>
        <button onClick={() => setDialog({ kind: "new" })}>New</button>
        <button onClick={() => setDialog({ kind: "open" })}>Open…</button>
        <button disabled={!context} onClick={() => (current?.path ? void api.save(context!).then(() => notify(`Saved ${current.path}`), failed) : setDialog({ kind: "save" }))}>
          Save
        </button>
        <span className="spacer" />
        <button disabled={!context} onClick={undo} title="Undo your own latest edit">
          Undo
        </button>
        <button disabled={!context} onClick={() => setDialog({ kind: "catalog" })}>
          Catalog
        </button>
        <button disabled={!context || structural > 0} onClick={verify} title={structural > 0 ? "Solve the structural errors first" : "Verify against the System's profile"}>
          Verify
        </button>
        <button disabled={!context || structural > 0} onClick={specification}>
          Specification
        </button>
      </header>

      {!context ? (
        <main className="welcome">
          <h1>Design a System as a precise model</h1>
          <p>Create a new System, or open a System file the host can read.</p>
          <div className="row-buttons">
            <button className="primary" onClick={() => setDialog({ kind: "new" })}>
              New System
            </button>
            <button onClick={() => setDialog({ kind: "open" })}>Open a file…</button>
          </div>
        </main>
      ) : (
        <main className="workspace">
          <nav className="perspectives">
            {perspectives.map((p) => (
              <button key={p.perspective} className={p.perspective === perspective ? "active" : ""} title={p.about} onClick={() => saveLayout({ ...layout, perspective: p.perspective })}>
                {p.title}
              </button>
            ))}
            {perspective === "language" && (
              <select value={language ?? ""} onChange={(e) => saveLayout({ ...layout, language: e.target.value })} aria-label="Language">
                {languages.map((l) => (
                  <option key={l.subject} value={l.subject}>
                    {l.label}
                  </option>
                ))}
              </select>
            )}
          </nav>

          <section className="view">
            {view &&
              (GRAPHS.has(perspective) ? (
                <Graph
                  key={`${context}/${perspective}/${language}`}
                  view={view}
                  saved={layout.positions?.[`${perspective}${perspective === "language" ? `/${language}` : ""}`] ?? {}}
                  selected={selected}
                  onSelect={select}
                  onMove={(positions) => saveLayout({ ...layout, positions: { ...layout.positions, [`${perspective}${perspective === "language" ? `/${language}` : ""}`]: positions } })}
                />
              ) : (
                <Tree
                  view={view}
                  selected={selected}
                  collapsed={new Set(layout.collapsed ?? [])}
                  onToggle={(id) => {
                    const collapsed = new Set(layout.collapsed ?? []);
                    if (collapsed.has(id)) collapsed.delete(id);
                    else collapsed.add(id);
                    saveLayout({ ...layout, collapsed: [...collapsed] });
                  }}
                  onSelect={select}
                />
              ))}
          </section>

          <aside className="inspector">
            {selectedItem ? (
              <div className="selection">
                <span className="kind">{selectedItem.kind}</span>
                <h2>{selectedItem.label}</h2>
                {selectedItem.detail && <p className="detail">{selectedItem.detail}</p>}
                <code className="id">{selectedItem.subject}</code>
                {diagnostics
                  .filter((d) => d.subjects.includes(selectedItem.subject))
                  .map((d, i) => (
                    <p key={i} className={`mark ${d.severity}`}>
                      <b>{d.check}</b> {d.message}
                    </p>
                  ))}
              </div>
            ) : (
              <p className="hint">Select something to edit it, or pick an operation below.</p>
            )}
            <Editors operations={operations} elements={elements} selected={selectedItem ? { id: selectedItem.subject, kind: selectedItem.kind } : undefined} onRun={apply} />
          </aside>

          <section className="bottom">
            <nav className="tabs">
              <button className={tab === "diagnostics" ? "active" : ""} onClick={() => setTab("diagnostics")}>
                Diagnostics {diagnostics.length > 0 && <span className={`badge ${structural > 0 ? "error" : "warning"}`}>{diagnostics.length}</span>}
              </button>
              <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
                History <span className="count">{history.length}</span>
              </button>
              <button className={tab === "verification" ? "active" : ""} onClick={() => setTab("verification")}>
                Verification
              </button>
            </nav>
            <div className="tab-body">
              {tab === "diagnostics" &&
                (diagnostics.length === 0 ? (
                  <p className="ok">No structural errors. {run ? "" : "Verify to check the design's rules."}</p>
                ) : (
                  <ul className="diagnostics">
                    {diagnostics.map((d, i) => (
                      <li key={i} className={d.severity} onClick={() => d.subjects[0] && select(d.subjects[0])}>
                        <span className={`badge ${d.severity}`}>{d.kind === "condition" ? "structural" : d.severity}</span>
                        <b>{d.check}</b> {d.message}
                        {d.suggestions.map((s, j) => (
                          <div key={j} className="suggestion">
                            → {s.message}
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                ))}
              {tab === "history" && (
                <ol className="history" reversed>
                  {[...history].reverse().map((edit) => (
                    <li key={edit.id} className={edit.author === session ? "mine" : ""}>
                      <span className={`op-kind ${edit.kind}`} />
                      <span className="who">{edit.client}</span> {edit.summary}
                    </li>
                  ))}
                </ol>
              )}
              {tab === "verification" &&
                (run ? (
                  <div>
                    <p>
                      Profile <b>{run.profile}</b> ({run.script}), {run.rules} rules, at edit {run.atEdit}: <b>{run.errors}</b> errors, <b>{run.warnings}</b> warnings
                      {run.failures.length > 0 && `, ${run.failures.length} failed rules`}.
                    </p>
                    <ul className="diagnostics">
                      {run.violations.map((v, i) => (
                        <li key={i} className={v.severity} onClick={() => v.subjects[0] && select(v.subjects[0])}>
                          <span className={`badge ${v.severity}`}>{v.severity}</span> <b>{v.rule}</b> {v.message}
                        </li>
                      ))}
                      {run.failures.map((f, i) => (
                        <li key={`f${i}`} className="error">
                          <span className="badge error">failed</span> <b>{f.rule}</b> <pre>{f.error}</pre>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="hint">Not verified yet.</p>
                ))}
            </div>
          </section>
        </main>
      )}

      {message && (
        <div className={`toast ${message.error ? "error" : ""}`} onClick={() => setMessage(undefined)}>
          {message.text}
        </div>
      )}
      {dialog && <DialogView dialog={dialog} context={context} session={session} close={() => setDialog(undefined)} onContext={setContext} notify={notify} />}
    </div>
  );
}

function DialogView(props: {
  dialog: Dialog;
  context?: string;
  session?: string;
  close(): void;
  onContext(id: string): void;
  notify(text: string, error?: boolean): void;
}) {
  const { dialog, context, session, close, onContext, notify } = props;
  const [value, setValue] = useState("");
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [error, setError] = useState<string | undefined>();
  useEffect(() => {
    if (dialog.kind === "catalog") void api.catalog(value).then(setPackages, (e) => setError(e.message));
  }, [dialog.kind, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (dialog.kind === "new") onContext((await api.create(value || "Untitled")).id);
      if (dialog.kind === "open") {
        const opened = await api.open(value);
        onContext(opened.id);
        if (opened.problems.length > 0) notify(`${opened.problems.length} references could not be followed`, true);
      }
      if (dialog.kind === "save" && context) notify(`Saved ${(await api.save(context, value)).path}`);
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const title = { new: "New System", open: "Open a System file", save: "Save as", catalog: "Catalog", specification: "Specification" }[dialog.kind];
  return (
    <div className="backdrop" onClick={close}>
      <div className="dialog" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {(dialog.kind === "new" || dialog.kind === "open" || dialog.kind === "save") && (
          <form onSubmit={submit}>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={dialog.kind === "new" ? "Name" : "Path, relative to where the host runs: examples/game.systemathic.json"}
            />
            <div className="row-buttons">
              <button type="button" onClick={close}>
                Cancel
              </button>
              <button className="primary" type="submit">
                {dialog.kind === "new" ? "Create" : dialog.kind === "open" ? "Open" : "Save"}
              </button>
            </div>
          </form>
        )}
        {dialog.kind === "catalog" && (
          <>
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search: http, network, data…" />
            <ul className="packages">
              {packages.map((p) => (
                <li key={p.id}>
                  <div>
                    <b>{p.name}</b> <span className="tags">{p.tags.join(" · ")}</span>
                    <p>{p.about}</p>
                  </div>
                  <button
                    className="primary"
                    disabled={!context || !session}
                    onClick={() =>
                      void api.importPackage(context!, session!, p.id).then((r) => {
                        notify(`Imported ${p.name}: ${r.edits.length} edits`);
                        close();
                      }, (e) => setError(e.message))
                    }
                  >
                    Import
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {dialog.kind === "specification" && (
          <>
            <pre className="markdown">{dialog.markdown}</pre>
            <div className="row-buttons">
              <button onClick={() => void navigator.clipboard.writeText(dialog.markdown).then(() => notify("Copied"))}>Copy</button>
              <button className="primary" onClick={close}>
                Close
              </button>
            </div>
          </>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}
