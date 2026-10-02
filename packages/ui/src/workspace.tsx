/**
 * One open System, as the UI holds it: the model read from the host, its Diagnostics and
 * History, our own session, the open tabs, and the actions every editor uses. Every Edit, by
 * any client, makes it read the System again.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type ContextInfo, type Diagnostic, type EditInfo, type OperationInfo, type RunInfo } from "./api";
import { Model, tabKey, type Tab } from "./model";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error" | "ok";
  undo?: boolean;
}

export interface UiLayout {
  tabs?: Tab[];
  active?: string;
  /** Explorer nodes collapsed. */
  collapsed?: string[];
  /** Diagram positions, by diagram. */
  positions?: Record<string, Record<string, [number, number]>>;
  /** Per Language editor: the diagram or the lists. */
  languageMode?: Record<string, "lists" | "diagram">;
  /** Sizes of the panes a person has resized, in pixels, by pane. */
  sizes?: Record<string, number>;
}

export interface Workspace {
  context: string;
  info?: ContextInfo;
  session?: string;
  model?: Model;
  diagnostics: Diagnostic[];
  history: EditInfo[];
  run?: RunInfo;
  operations: OperationInfo[];
  /** Changes whenever the System does, for views that read it themselves. */
  version: number;
  /** Diagnostics by the ids they are about. */
  about(id: string): Diagnostic[];
  structural: number;

  /** Runs an editor operation in our session; undefined if it was refused (the reason is shown). */
  act(editor: string, operation: string, args: Record<string, unknown>, options?: { quiet?: boolean; message?: string }): Promise<EditInfo | undefined>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  save(path?: string): Promise<boolean>;
  verify(): Promise<void>;

  tabs: Tab[];
  active?: string;
  open(tab: Tab, focus?: string): void;
  /** Opens the editor of whatever `id` is, scrolled to it. */
  reveal(id: string): void;
  close(key: string): void;
  activate(key: string): void;
  /** The id an editor should bring into view, and when it was asked for. */
  focus?: { id: string; at: number };

  layout: UiLayout;
  setLayout(change: (layout: UiLayout) => UiLayout): void;

  toasts: Toast[];
  notify(text: string, tone?: Toast["tone"], undo?: boolean): void;
  dismiss(id: number): void;
}

const WorkspaceContext = createContext<Workspace | undefined>(undefined);

export function useWorkspace(): Workspace {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("no workspace");
  return value;
}

/** The model, once it is read. Editors render only then. */
export function useModel(): Model {
  return useWorkspace().model!;
}

export function WorkspaceProvider(props: { context: string; info?: ContextInfo; operations: OperationInfo[]; children: ReactNode; onEvent: (listener: (event: import("./api").HostEvent) => void) => () => void }) {
  const { context, operations } = props;
  const [session, setSession] = useState<string>();
  const [model, setModel] = useState<Model>();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [history, setHistory] = useState<EditInfo[]>([]);
  const [run, setRun] = useState<RunInfo>();
  const [version, setVersion] = useState(0);
  const [layout, setLayoutState] = useState<UiLayout>({});
  const [loaded, setLoaded] = useState(false);
  const [focus, setFocus] = useState<{ id: string; at: number }>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToast = useRef(1);
  const sessionRef = useRef<string | undefined>(undefined);
  /** The model last read, for what runs right after an Edit, before a render catches up. */
  const latest = useRef<Model | undefined>(undefined);

  const notify = useCallback((text: string, tone: Toast["tone"] = "info", undo = false) => {
    const id = nextToast.current++;
    setToasts((all) => [...all.slice(-3), { id, text, tone, undo }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), tone === "error" ? 9000 : 4500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const failed = useCallback((error: unknown) => notify((error as Error).message, "error"), [notify]);

  const read = useCallback(async () => {
    try {
      const [file, d, h] = await Promise.all([api.system(context), api.diagnostics(context), api.history(context)]);
      const next = new Model(file);
      latest.current = next;
      setModel(next);
      setDiagnostics(d);
      setHistory(h);
      setVersion((v) => v + 1);
    } catch (error) {
      failed(error);
    }
  }, [context, failed]);

  // Our session, the System, and the layout we left it in.
  useEffect(() => {
    let ended = false;
    let ours: string | undefined;
    void api.startSession(context).then(({ session }) => {
      ours = session;
      if (ended) api.endSession(context, session);
      else {
        sessionRef.current = session;
        setSession(session);
      }
    }, failed);
    void read();
    void api.attachment(context, "ui").then((data) => {
      setLayoutState((data as UiLayout | null) ?? {});
      setLoaded(true);
    }, failed);
    const end = () => ours && api.endSession(context, ours);
    window.addEventListener("pagehide", end);
    return () => {
      ended = true;
      window.removeEventListener("pagehide", end);
      end();
    };
  }, [context, read, failed]);

  useEffect(
    () =>
      props.onEvent((event) => {
        if (!("context" in event) || event.context !== context) return;
        if (event.type === "verified") setRun(event.run);
        if (event.type === "edit") {
          if (event.edit.author !== sessionRef.current) notify(`${event.edit.client}: ${event.edit.summary}`, "info");
          void read();
        }
      }),
    [context, read, notify, props],
  );

  // The layout is kept with the System, as the UI's attachment; written a moment after it settles.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setLayout = useCallback(
    (change: (layout: UiLayout) => UiLayout) => {
      setLayoutState((current) => {
        const next = change(current);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void api.setAttachment(context, "ui", next).catch(() => undefined), 600);
        return next;
      });
    },
    [context],
  );

  const tabs = useMemo(() => {
    const kept = (layout.tabs ?? []).filter((tab) => !("id" in tab) || model === undefined || model.get(tab.id));
    return kept.length > 0 ? kept : [{ kind: "system" } as Tab];
  }, [layout.tabs, model]);
  const active = layout.active && tabs.some((t) => tabKey(t) === layout.active) ? layout.active : tabKey(tabs[0]!);

  const open = useCallback(
    (tab: Tab, focusId?: string) => {
      const key = tabKey(tab);
      setLayout((l) => {
        const current = l.tabs ?? [{ kind: "system" } as Tab];
        return { ...l, tabs: current.some((t) => tabKey(t) === key) ? current : [...current, tab], active: key };
      });
      if (focusId) setFocus({ id: focusId, at: Date.now() });
    },
    [setLayout],
  );

  const reveal = useCallback(
    (id: string) => {
      // The newest model, which may be newer than this render's: what was just added is in it.
      const home = latest.current?.home(id);
      if (home) open(home.tab, home.focus ?? id);
    },
    [open],
  );

  const close = useCallback(
    (key: string) =>
      setLayout((l) => {
        const current = (l.tabs ?? []).filter((t) => tabKey(t) !== key);
        const index = (l.tabs ?? []).findIndex((t) => tabKey(t) === key);
        const next = l.active === key ? current[Math.max(0, index - 1)] : undefined;
        return { ...l, tabs: current, active: next ? tabKey(next) : l.active };
      }),
    [setLayout],
  );

  const act = useCallback<Workspace["act"]>(
    async (editor, operation, args, options = {}) => {
      if (!session) return undefined;
      try {
        const edit = await api.apply(context, session, editor, operation, args);
        if (!options.quiet) notify(options.message ?? edit.summary, "info", true);
        await read();
        return edit;
      } catch (error) {
        failed(error);
        return undefined;
      }
    },
    [context, session, read, notify, failed],
  );

  const undo = useCallback(async () => {
    if (!session) return;
    const edit = await api.undo(context, session).catch(failed);
    notify(edit ? edit.summary : "Nothing of yours to undo");
    if (edit) await read();
  }, [context, session, read, notify, failed]);

  const redo = useCallback(async () => {
    if (!session) return;
    const edit = await api.redo(context, session).catch(failed);
    notify(edit ? edit.summary : "Nothing to redo");
    if (edit) await read();
  }, [context, session, read, notify, failed]);

  const save = useCallback(
    async (path?: string) => {
      try {
        const saved = await api.save(context, path);
        notify(`Saved ${saved.path.split(/[\\/]/).pop()}`, "ok");
        return true;
      } catch (error) {
        failed(error);
        return false;
      }
    },
    [context, notify, failed],
  );

  const verify = useCallback(async () => {
    try {
      const result = await api.verify(context);
      setRun(result);
      notify(`${result.profile}: ${result.errors} errors, ${result.warnings} warnings${result.failures.length ? `, ${result.failures.length} failed rules` : ""}`, result.errors ? "error" : "ok");
      await read();
    } catch (error) {
      failed(error);
    }
  }, [context, notify, failed, read]);

  const bySubject = useMemo(() => {
    const index = new Map<string, Diagnostic[]>();
    for (const d of diagnostics) for (const s of d.subjects) index.set(s, [...(index.get(s) ?? []), d]);
    return index;
  }, [diagnostics]);

  const value: Workspace = {
    context,
    info: props.info,
    session,
    model,
    diagnostics,
    history,
    run,
    operations,
    version,
    about: (id) => bySubject.get(id) ?? [],
    structural: diagnostics.filter((d) => d.kind === "condition" && d.severity === "error").length,
    act,
    undo,
    redo,
    save,
    verify,
    tabs,
    active,
    open,
    reveal,
    close,
    activate: (key) => setLayout((l) => ({ ...l, active: key })),
    focus,
    layout,
    setLayout,
    toasts,
    notify,
    dismiss,
  };
  if (!loaded || !model) return <div className="loading">Opening…</div>;
  return <WorkspaceContext.Provider value={value}>{props.children}</WorkspaceContext.Provider>;
}

/** Scrolls the row for `id` into view and flashes it, when the workspace asks for it. */
export function useFocusRow(id: string): (element: HTMLElement | null) => void {
  const { focus } = useWorkspace();
  return useCallback(
    (element: HTMLElement | null) => {
      if (!element || focus?.id !== id || Date.now() - focus.at > 1500) return;
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      element.classList.remove("flash");
      void element.offsetWidth;
      element.classList.add("flash");
    },
    [focus, id],
  );
}

/**
 * A pane's size: what the person last made it, or `initial`. Resizing is live and local; the
 * size is kept with the System's layout once the drag ends.
 */
export function useSize(key: string, initial: number): [number, (size: number) => void, (size: number) => void] {
  const { layout, setLayout } = useWorkspace();
  const kept = layout.sizes?.[key] ?? initial;
  const [live, setLive] = useState<number>();
  const keep = useCallback(
    (size: number) => {
      setLive(undefined);
      setLayout((l) => ({ ...l, sizes: { ...l.sizes, [key]: Math.round(size) } }));
    },
    [key, setLayout],
  );
  return [live ?? kept, setLive, keep];
}
