/**
 * The UI: a client of the host. A System opens into a workspace — the Explorer, editors in
 * tabs, the Problems panel — with its own EditSession; what other clients do arrives live.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type ContextInfo, type HostEvent, type OperationInfo, type PackageSummary } from "./api";
import { DomainEditor } from "./editors/DomainEditor";
import { LanguageEditor } from "./editors/LanguageEditor";
import { MediationEditor } from "./editors/MediationEditor";
import { SystemEditor } from "./editors/SystemEditor";
import { TransformationEditor } from "./editors/TransformationEditor";
import { Explorer } from "./Explorer";
import { tabKey, type Tab } from "./model";
import { Palette, type Command } from "./Palette";
import { Panel, type PanelTab } from "./Panel";
import { SpecificationTab, ViewTab } from "./ViewTab";
import { Icon, IconButton, Splitter } from "./widgets";
import { useModel, useSize, useWorkspace, WorkspaceProvider } from "./workspace";

type Dialog = "open" | "new" | "save" | "catalog" | undefined;

/** The script editor brings a code editor with it: loaded when first opened. */
const ScriptTab = lazy(() => import("./ScriptTab").then((m) => ({ default: m.ScriptTab })));

/** One stream of host events, shared by everything that listens. */
function useEvents() {
  const listeners = useRef(new Set<(event: HostEvent) => void>());
  const [connected, setConnected] = useState(true);
  useEffect(() => api.events((event) => listeners.current.forEach((l) => l(event)), setConnected), []);
  const subscribe = useCallback((listener: (event: HostEvent) => void) => {
    listeners.current.add(listener);
    return () => void listeners.current.delete(listener);
  }, []);
  return { subscribe, connected };
}

export function App() {
  const [operations, setOperations] = useState<OperationInfo[]>([]);
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [context, setContextState] = useState<string | undefined>(() => location.hash.slice(1) || undefined);
  const [dialog, setDialog] = useState<Dialog>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const events = useEvents();
  // A host started before this page was built does not know its newest requests: say so, rather than fail in pieces.
  useEffect(() => void api.files().catch((e) => e instanceof ApiError && e.status === 404 && setStale(true)), []);

  const setContext = (id: string | undefined) => {
    setContextState(id);
    history.replaceState(null, "", id ? `#${id}` : location.pathname);
  };

  const refreshContexts = useCallback(() => api.contexts().then(setContexts, (e) => setError(e.message)), []);
  useEffect(() => {
    void api.editors().then(setOperations, (e) => setError(e.message));
    void refreshContexts();
  }, [refreshContexts]);
  useEffect(() => events.subscribe((event) => (event.type === "contexts" || event.type === "saved" || event.type === "edit") && void refreshContexts()), [events, refreshContexts]);
  useEffect(() => {
    if (context && contexts.length > 0 && !contexts.some((c) => c.id === context)) setContext(undefined);
  }, [context, contexts]);

  const info = contexts.find((c) => c.id === context);
  /** Shows a System once the list of open ones has it. */
  const show = (id: string) => void refreshContexts().then(() => setContext(id));

  return (
    <div className="app">
      {!events.connected && <div className="offline">The host is not answering. Is <code>systemathic serve</code> still running?</div>}
      {stale && (
        <div className="offline">
          The host serving this page is older than the page. Stop <code>systemathic serve</code> and start it again to update it.
        </div>
      )}
      {context && info ? (
        <WorkspaceProvider key={context} context={context} info={info} operations={operations} onEvent={events.subscribe}>
          <Shell contexts={contexts} onContext={setContext} onDialog={setDialog} />
          {dialog === "catalog" && <CatalogDialog close={() => setDialog(undefined)} />}
          {dialog === "save" && <SaveAsDialog close={() => setDialog(undefined)} />}
        </WorkspaceProvider>
      ) : (
        <Welcome contexts={contexts} onContext={show} onDialog={setDialog} error={error} />
      )}
      {(dialog === "open" || dialog === "new") && (
        <OpenDialog
          mode={dialog}
          close={() => setDialog(undefined)}
          onOpened={(id) => {
            setDialog(undefined);
            show(id);
          }}
        />
      )}
    </div>
  );
}

function Welcome(props: { contexts: ContextInfo[]; onContext(id: string): void; onDialog(d: Dialog): void; error?: string }) {
  const [files, setFiles] = useState<string[]>([]);
  useEffect(() => void api.files().then(setFiles, () => setFiles([])), []);
  const open = async (path: string) => {
    const opened = await api.open(path);
    props.onContext(opened.id);
  };
  return (
    <main className="welcome">
      <div className="welcome-mark">
        <Icon name="Domain" size={40} />
      </div>
      <h1>Systemathic</h1>
      <p className="lead">Design a system as a precise model: closed vocabularies, the contexts that use them, and explicit crossings between them — checked, and exported as a contract.</p>
      {props.error && <p className="inline-problem error">{props.error}</p>}
      <div className="welcome-actions">
        <button className="primary big" onClick={() => props.onDialog("new")}>
          <Icon name="plus" /> New System
        </button>
        <button className="big" onClick={() => props.onDialog("open")}>
          <Icon name="open" /> Open a file…
        </button>
      </div>
      {props.contexts.length > 0 && (
        <section className="welcome-list">
          <h2>Open now</h2>
          {props.contexts.map((c) => (
            <button key={c.id} onClick={() => props.onContext(c.id)}>
              <Icon name="System" />
              <span className="card-title">{c.name}</span>
              <span className="muted">{c.path?.split(/[\\/]/).pop() ?? "not saved"}</span>
              {c.clients.length > 0 && <span className="muted">· {c.clients.join(", ")} editing</span>}
            </button>
          ))}
        </section>
      )}
      {files.length > 0 && (
        <section className="welcome-list">
          <h2>System files here</h2>
          {files.map((f) => (
            <button key={f} onClick={() => void open(f)}>
              <Icon name="open" />
              <span className="card-title">{f.split("/").pop()}</span>
              <span className="muted">{f}</span>
            </button>
          ))}
        </section>
      )}
    </main>
  );
}

function Shell(props: { contexts: ContextInfo[]; onContext(id: string | undefined): void; onDialog(d: Dialog): void }) {
  const w = useWorkspace();
  const model = useModel();
  const [palette, setPalette] = useState(false);
  const [sidebar, resizeSidebar, keepSidebar] = useSize("sidebar", 270);
  const [panelHeight, resizePanel, keepPanel] = useSize("panel", 240);
  const [panel, setPanel] = useState<PanelTab | undefined>(w.structural > 0 ? "problems" : undefined);
  const [lastPanel, setLastPanel] = useState<PanelTab>("problems");
  const showPanel = (tab: PanelTab | undefined) => {
    setPanel(tab);
    if (tab) setLastPanel(tab);
  };
  const save = useCallback(() => (w.info?.path ? void w.save() : props.onDialog("save")), [w, props]);

  const commands = useMemo<Command[]>(() => {
    const system = model.system.id;
    const add = (operation: string, what: string) => async () => {
      const edit = await w.act("SystemEditor", operation, { system, name: `New${what}` }, { quiet: true });
      if (edit) w.reveal(edit.elements[0]!);
    };
    return [
      { label: "New Language", icon: "Language", hint: "command", run: add("addLanguage", "Language") },
      { label: "New Domain", icon: "Domain", hint: "command", run: add("addDomain", "Domain") },
      { label: "New Mediation", icon: "Mediation", hint: "command", run: () => w.open({ kind: "system" }, "#new-mediation") },
      { label: "Import from the catalog", icon: "catalog", hint: "command", run: () => props.onDialog("catalog") },
      { label: "Verify", icon: "play", hint: "command", run: () => void w.verify() },
      { label: "Edit the verification script", icon: "play", hint: "command", run: () => w.open({ kind: "script" }) },
      { label: "Specification", icon: "specification", hint: "command", run: () => w.open({ kind: "specification" }) },
      { label: "Save", icon: "save", hint: "command", shortcut: "Ctrl+S", run: save },
      { label: "Save as…", icon: "save", hint: "command", run: () => props.onDialog("save") },
      { label: "Undo", icon: "undo", hint: "command", shortcut: "Ctrl+Z", run: () => void w.undo() },
      { label: "Redo", icon: "redo", hint: "command", shortcut: "Ctrl+Shift+Z", run: () => void w.redo() },
      { label: "Show Problems", icon: "error", hint: "command", run: () => showPanel("problems") },
      { label: "Show History", icon: "undo", hint: "command", run: () => showPanel("history") },
      { label: "System overview", icon: "System", hint: "view", run: () => w.open({ kind: "system" }) },
      { label: "Domain map", icon: "diagram", hint: "view", run: () => w.open({ kind: "view", perspective: "domain-map" }) },
      { label: "Mediation stack", icon: "Mediation", hint: "view", run: () => w.open({ kind: "view", perspective: "mediation-stack" }) },
      { label: "Levels", icon: "table", hint: "view", run: () => w.open({ kind: "view", perspective: "levels" }) },
      { label: "Statistics", icon: "table", hint: "view", run: () => w.open({ kind: "view", perspective: "statistics" }) },
      { label: "Open another System…", icon: "open", hint: "command", run: () => props.onDialog("open") },
      { label: "Close this System", icon: "x", hint: "command", run: () => props.onContext(undefined) },
    ];
  }, [model, w, props, save]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const mod = event.ctrlKey || event.metaKey;
      const typing = event.target instanceof HTMLElement && (event.target.closest("input, textarea, select, .cm-editor") !== null);
      if (mod && event.key.toLowerCase() === "k") (event.preventDefault(), setPalette((p) => !p));
      else if (mod && event.key.toLowerCase() === "s") (event.preventDefault(), save());
      else if (mod && event.key.toLowerCase() === "j") (event.preventDefault(), showPanel(panel ? undefined : lastPanel));
      else if (!typing && mod && event.key.toLowerCase() === "z") (event.preventDefault(), void (event.shiftKey ? w.redo() : w.undo()));
      else if (!typing && mod && event.key.toLowerCase() === "y") (event.preventDefault(), void w.redo());
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [w, save, panel, lastPanel]);

  const active = w.tabs.find((t) => tabKey(t) === w.active) ?? w.tabs[0]!;
  const errors = w.diagnostics.filter((d) => d.severity === "error").length;
  const warnings = w.diagnostics.length - errors;
  const others = (w.info?.clients ?? []).filter((c, i, all) => !(c === "ui" && all.indexOf("ui") === i));

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => props.onContext(undefined)} title="All Systems">
          <Icon name="Domain" size={18} /> Systemathic
        </button>
        <select className="system-switch" value={w.context} onChange={(e) => props.onContext(e.target.value)} aria-label="System">
          {props.contexts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.dirty ? " •" : ""}
            </option>
          ))}
        </select>
        <IconButton icon="open" label="Open" onClick={() => props.onDialog("open")} />
        <IconButton icon="save" label={w.info?.dirty ? "Save (unsaved changes)" : "Save"} shortcut="Ctrl+S" onClick={save} className={w.info?.dirty ? "dirty" : ""} />
        <span className="divider" />
        <IconButton icon="undo" label="Undo your last edit" shortcut="Ctrl+Z" onClick={() => void w.undo()} />
        <IconButton icon="redo" label="Redo" shortcut="Ctrl+Shift+Z" onClick={() => void w.redo()} />
        <button className="palette-button" onClick={() => setPalette(true)}>
          <Icon name="search" size={14} /> Go to anything or run a command… <kbd>Ctrl K</kbd>
        </button>
        <span className="spacer" />
        <button className="small" onClick={() => props.onDialog("catalog")}>
          <Icon name="catalog" /> Catalog
        </button>
        <button className="small primary" disabled={w.structural > 0} title={w.structural > 0 ? "Solve the structural errors first" : "Verify against the System's rules"} onClick={() => void w.verify()}>
          <Icon name="play" /> Verify
        </button>
      </header>

      <div className="body" style={{ gridTemplateColumns: `${sidebar}px auto 1fr` }}>
        <aside className="sidebar">
          <Explorer />
        </aside>
        <Splitter axis="x" size={sidebar} grows="with" min={180} max={560} initial={270} onResize={resizeSidebar} onResized={keepSidebar} label="Resize the Explorer" />
        <main className="main">
          <nav className="tabstrip" role="tablist">
            {w.tabs.map((tab) => {
              const key = tabKey(tab);
              const { icon, label } = tabTitle(tab, model);
              return (
                <div key={key} role="tab" aria-selected={key === w.active} className={`tab ${key === w.active ? "on" : ""}`} onClick={() => w.activate(key)} onAuxClick={(e) => e.button === 1 && w.close(key)}>
                  <Icon name={icon} size={14} />
                  <span>{label}</span>
                  {w.tabs.length > 1 && (
                    <button
                      className="tab-close"
                      aria-label={`Close ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        w.close(key);
                      }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="tab-content" key={tabKey(active)}>
            <Editor tab={active} onCatalog={() => props.onDialog("catalog")} />
          </div>
          {panel && (
            <>
              <Splitter axis="y" size={panelHeight} grows="against" min={100} max={Math.round(window.innerHeight * 0.75)} initial={240} onResize={resizePanel} onResized={keepPanel} label="Resize the panel" />
              <Panel height={panelHeight} tab={panel} onTab={showPanel} onClose={() => showPanel(undefined)} />
            </>
          )}
        </main>
      </div>

      <footer className="statusbar">
        <button className={errors ? "status-errors" : ""} onClick={() => showPanel(panel === "problems" ? undefined : "problems")}>
          <Icon name="error" size={13} /> {errors} <Icon name="warning" size={13} /> {warnings}
        </button>
        <button onClick={() => showPanel(panel === "verification" ? undefined : "verification")}>
          {w.run ? `${w.run.profile}: ${w.run.errors} errors${w.run.atEdit !== w.history.length ? " (stale)" : ""}` : "not verified"}
        </button>
        <button onClick={() => showPanel(panel === "history" ? undefined : "history")}>{w.history.length} edits</button>
        <span className="spacer" />
        {others.length > 0 && (
          <span className="presence" title="Also editing this System">
            <span className="presence-dot" /> {others.join(", ")}
          </span>
        )}
        <span>{w.info?.dirty ? "unsaved changes" : w.info?.path ? "saved" : "not saved yet"}</span>
        <span className="muted">{w.info?.path?.split(/[\\/]/).pop()}</span>
      </footer>

      {palette && <Palette commands={commands} close={() => setPalette(false)} />}
      <Toasts />
    </div>
  );
}

function Editor({ tab, onCatalog }: { tab: Tab; onCatalog(): void }) {
  switch (tab.kind) {
    case "system":
      return <SystemEditor onCatalog={onCatalog} />;
    case "language":
      return <LanguageEditor id={tab.id} />;
    case "domain":
      return <DomainEditor id={tab.id} />;
    case "transformation":
      return <TransformationEditor id={tab.id} />;
    case "mediation":
      return <MediationEditor id={tab.id} />;
    case "view":
      return <ViewTab perspective={tab.perspective} />;
    case "specification":
      return <SpecificationTab />;
    case "script":
      return (
        <Suspense fallback={<p className="empty">Loading the editor…</p>}>
          <ScriptTab />
        </Suspense>
      );
  }
}

function tabTitle(tab: Tab, model: ReturnType<typeof useModel>): { icon: string; label: string } {
  switch (tab.kind) {
    case "system":
      return { icon: "System", label: "Overview" };
    case "view":
      return { icon: "diagram", label: { "domain-map": "Domain map", "mediation-stack": "Mediation stack", levels: "Levels", statistics: "Statistics" }[tab.perspective] ?? tab.perspective };
    case "specification":
      return { icon: "specification", label: "Specification" };
    case "script":
      return { icon: "play", label: "Verification script" };
    default:
      return { icon: tab.kind.charAt(0).toUpperCase() + tab.kind.slice(1), label: model.name(tab.id) };
  }
}

function Toasts() {
  const w = useWorkspace();
  return (
    <div className="toasts" aria-live="polite">
      {w.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.text}</span>
          {t.undo && (
            <button
              onClick={() => {
                w.dismiss(t.id);
                void w.undo();
              }}
            >
              Undo
            </button>
          )}
          <button className="toast-close" aria-label="Dismiss" onClick={() => w.dismiss(t.id)}>
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function OpenDialog({ mode, close, onOpened }: { mode: "open" | "new"; close(): void; onOpened(id: string): void }) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (mode === "open") void api.files().then(setFiles, () => setFiles([]));
  }, [mode]);
  const open = async (path: string) => {
    try {
      onOpened((await api.open(path)).id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "open") return open(value);
    try {
      onOpened((await api.create(value || "Untitled")).id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const shown = files.filter((f) => f.toLowerCase().includes(value.toLowerCase()));
  return (
    <Modal title={mode === "new" ? "New System" : "Open a System"} close={close}>
      <form onSubmit={submit}>
        <input autoFocus className="wide" value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "new" ? "Its name — e.g. Shop" : "Filter, or a path relative to where the host runs"} />
        {mode === "open" && (
          <ul className="file-list">
            {shown.map((f) => (
              <li key={f}>
                <button type="button" onClick={() => void open(f)}>
                  <Icon name="open" /> <span className="card-title">{f.split("/").pop()}</span> <span className="muted">{f}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="muted">No System file matches; press Enter to open the path as typed.</li>}
          </ul>
        )}
        {error && <p className="inline-problem error">{error}</p>}
        <div className="row-buttons">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" type="submit">
            {mode === "new" ? "Create" : "Open"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SaveAsDialog({ close }: { close(): void }) {
  const w = useWorkspace();
  const [value, setValue] = useState(w.info?.path ? "" : `${w.model?.system.name.replace(/\W+/g, "-").toLowerCase() || "system"}.systemathic.json`);
  return (
    <Modal title="Save as" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await w.save(value)) close();
        }}
      >
        <input autoFocus className="wide" value={value} onChange={(e) => setValue(e.target.value)} placeholder="A path relative to where the host runs, ending in .systemathic.json" />
        <div className="row-buttons">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={!value}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CatalogDialog({ close }: { close(): void }) {
  const w = useWorkspace();
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [all, setAll] = useState<PackageSummary[]>([]);
  useEffect(() => void api.catalog().then(setAll), []);
  useEffect(() => void api.catalog(text, tag).then(setPackages), [text, tag]);
  const tags = [...new Set(all.flatMap((p) => p.tags))].sort();
  const imported = new Set(w.model?.languages.map((l) => l.id));
  return (
    <Modal title="Catalog" close={close} wide>
      <p className="muted">Standard Languages, Domains and Mediations to build on. Importing copies them into this System; what is already here is reused.</p>
      <input autoFocus className="wide" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search: http, network, data…" />
      <div className="tag-row">
        <button className={tag === "" ? "on" : ""} onClick={() => setTag("")}>
          all
        </button>
        {tags.map((t) => (
          <button key={t} className={tag === t ? "on" : ""} onClick={() => setTag(tag === t ? "" : t)}>
            {t}
          </button>
        ))}
      </div>
      <ul className="package-grid">
        {packages.map((p) => (
          <li key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <p>{p.about}</p>
              <span className="tags">{p.tags.join(" · ")}</span>
            </div>
            <button
              className="primary small"
              disabled={!w.session}
              onClick={async () => {
                const result = await api.importPackage(w.context, w.session!, p.id).catch((e) => (w.notify(e.message, "error"), undefined));
                if (!result) return;
                w.notify(`Imported ${p.name}: ${result.edits.length} added${result.reused.length ? `, ${result.reused.length} already here` : ""}`, "ok");
                close();
              }}
            >
              {imported.has(`lib.${p.id}`) ? "Import again" : "Import"}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export function Modal(props: { title: string; close(): void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const escape = (e: KeyboardEvent) => e.key === "Escape" && props.close();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [props]);
  return (
    <div className="backdrop" onMouseDown={props.close}>
      <div className={`dialog ${props.wide ? "wide" : ""}`} role="dialog" aria-label={props.title} onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{props.title}</h2>
          <IconButton icon="x" label="Close" onClick={props.close} />
        </header>
        {props.children}
      </div>
    </div>
  );
}
