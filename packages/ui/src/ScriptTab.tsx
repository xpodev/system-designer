/**
 * The verification script, edited in place: Python with highlighting, problems as you type,
 * completion of what a script can use and of this System's names, documentation on hover,
 * and a Run that saves the script and verifies the System with it.
 */
import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { linter, lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, hoverTooltip, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState } from "react";
import { api, type ScriptCheck as Check, type ScriptSymbol } from "./api";
import { Badge, download, Icon, InlineText, Splitter } from "./widgets";
import { useModel, useSize, useWorkspace } from "./workspace";

let symbolsOnce: Promise<ScriptSymbol[]> | undefined;
const loadSymbols = () => (symbolsOnce ??= api.symbols().catch(() => []));

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--code-keyword)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--code-string)" },
  { tag: tags.comment, color: "var(--code-comment)", fontStyle: "italic" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--code-number)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--code-function)" },
  { tag: [tags.definition(tags.variableName), tags.definition(tags.function(tags.variableName))], color: "var(--code-definition)", fontWeight: "600" },
  { tag: tags.className, color: "var(--code-class)" },
  { tag: tags.propertyName, color: "var(--code-property)" },
  { tag: tags.meta, color: "var(--code-decorator)" },
  { tag: tags.operator, color: "var(--code-operator)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--panel)", color: "var(--ink)" },
  ".cm-content": { fontFamily: "var(--mono)", caretColor: "var(--accent)" },
  ".cm-gutters": { backgroundColor: "var(--panel)", color: "var(--muted)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--hover)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--accent-soft) !important" },
  ".cm-tooltip": { backgroundColor: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px", boxShadow: "var(--shadow)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent)", color: "white" },
  ".cm-completionDetail": { color: "var(--muted)", fontStyle: "normal", marginLeft: "8px" },
});

function position(state: EditorState, line: number, column: number): number {
  const at = state.doc.line(Math.min(Math.max(1, line), state.doc.lines));
  return Math.min(at.from + Math.max(0, column - 1), at.to);
}

export function ScriptTab() {
  const w = useWorkspace();
  const model = useModel();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const [path, setPath] = useState<string>();
  const [exists, setExists] = useState(false);
  /** The profile the System is verified with: one of this script's. */
  const [profileName, setProfileName] = useState("profile");
  const [side, resizeSide, keepSide] = useSize("script-side", 320);
  const [saved, setSaved] = useState<string>();
  const [source, setSource] = useState<string>();
  const [check, setCheck] = useState<Check>();
  const [busy, setBusy] = useState(false);
  const names = useRef({ domains: [] as string[], languages: [] as string[] });
  names.current = { domains: model.domains.map((d) => d.name), languages: model.languages.map((l) => l.name) };
  const saveRef = useRef<() => Promise<boolean>>(async () => false);

  useEffect(() => {
    let alive = true;
    void api.script(w.context).then((script) => {
      if (!alive) return;
      setPath(script.path);
      setProfileName(script.profile);
      setExists(script.exists);
      setSaved(script.exists ? script.source : undefined);
      setSource(script.source);
    }, (e) => w.notify(e.message, "error"));
    return () => {
      alive = false;
    };
  }, [w.context]); // eslint-disable-line react-hooks/exhaustive-deps

  // The editor, made once the script is read.
  useEffect(() => {
    if (source === undefined || !host.current || view.current) return;
    const lint = linter(
      async (v): Promise<CmDiagnostic[]> => {
        const result = await api.checkScript(v.state.doc.toString()).catch(() => undefined);
        if (!result) return [];
        setCheck(result);
        return result.problems.map((p) => ({
          from: position(v.state, p.line, p.column),
          to: Math.max(position(v.state, p.endLine, p.endColumn), position(v.state, p.line, p.column) + 1),
          severity: p.severity,
          message: p.message,
        }));
      },
      { delay: 500 },
    );
    const complete = async (context: CompletionContext): Promise<CompletionResult | null> => {
      const quoted = context.matchBefore(/\.(domain|language)\(\s*["']([^"']*)$/);
      if (quoted) {
        const kind = quoted.text.startsWith(".domain") ? "domains" : "languages";
        const typed = quoted.text.match(/["']([^"']*)$/)![1]!;
        return { from: context.pos - typed.length, options: names.current[kind].map((label) => ({ label, type: "text", detail: kind === "domains" ? "Domain" : "Language" })), validFor: /^[^"']*$/ };
      }
      const word = context.matchBefore(/\.?\w*/);
      if (!word || (word.from === word.to && !context.explicit)) return null;
      const symbols = await loadSymbols();
      const afterDot = word.text.startsWith(".");
      const options: Completion[] = symbols
        .filter((s) => (afterDot ? s.kind === "property" || s.kind === "method" : s.kind !== "property" && s.kind !== "method"))
        .map((s) => ({
          label: s.name,
          type: s.kind === "rule" ? "function" : s.kind === "property" ? "property" : s.kind,
          detail: s.detail.length > 48 ? `${s.detail.slice(0, 47)}…` : s.detail,
          info: s.doc || undefined,
          boost: s.kind === "property" ? -1 : 0,
        }));
      return { from: afterDot ? word.from + 1 : word.from, options, validFor: /^\w*$/ };
    };
    const hover = hoverTooltip(async (v, pos) => {
      const { from, to, text } = v.state.doc.lineAt(pos);
      let start = pos;
      let end = pos;
      while (start > from && /\w/.test(text[start - from - 1]!)) start--;
      while (end < to && /\w/.test(text[end - from]!)) end++;
      if (start === end) return null;
      const name = text.slice(start - from, end - from);
      const found = (await loadSymbols()).filter((s) => s.name === name);
      if (found.length === 0) return null;
      return {
        pos: start,
        end,
        above: true,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "symbol-tooltip";
          for (const s of found.slice(0, 3)) {
            const head = document.createElement("code");
            head.textContent = s.detail;
            const doc = document.createElement("p");
            doc.textContent = s.doc || s.module;
            dom.append(head, doc);
          }
          return { dom };
        },
      };
    });
    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: source,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          bracketMatching(),
          python(),
          syntaxHighlighting(highlight),
          autocompletion({ override: [complete], activateOnTyping: true }),
          lint,
          lintGutter(),
          hover,
          theme,
          keymap.of([
            { key: "Mod-s", preventDefault: true, run: () => (void saveRef.current(), true) },
            { key: "Mod-Enter", preventDefault: true, run: () => (void runRef.current(), true) },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => update.docChanged && setSource(update.state.doc.toString())),
        ],
      }),
    });
    return () => {
      view.current?.destroy();
      view.current = undefined;
    };
  }, [source === undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (): Promise<boolean> => {
    if (!path || source === undefined) return false;
    try {
      const result = await api.saveScript(w.context, path, source);
      await api.setAttachment(w.context, "verifier", { script: result.path, profile: profileName });
      setPath(result.path);
      setSaved(source);
      setExists(true);
      w.notify(`Saved ${result.path}; the System is verified with its profile ${profileName}`, "ok");
      return true;
    } catch (e) {
      w.notify((e as Error).message, "error");
      return false;
    }
  };
  saveRef.current = save;

  const run = async () => {
    if (w.structural > 0) {
      w.notify("Solve the structural errors before verifying", "error");
      return;
    }
    setBusy(true);
    if (await save()) await w.verify();
    setBusy(false);
  };
  const runRef = useRef(run);
  runRef.current = run;

  // What is saved from elsewhere — VS Code, say — shows here when the window is back in focus, unless there are edits here.
  const state = useRef({ saved, source });
  state.current = { saved, source };
  useEffect(() => {
    const refresh = () =>
      void api.script(w.context).then((script) => {
        const { saved: known, source: current } = state.current;
        if (!script.exists || script.source === known || current !== known || !view.current) return;
        setSaved(script.source);
        view.current.dispatch({ changes: { from: 0, to: view.current.state.doc.length, insert: script.source } });
        w.notify("The script changed on disk; showing the new version", "info");
      });
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [w]);

  // A rule that failed in the last run is marked where it failed.
  useEffect(() => {
    const v = view.current;
    if (!v || !w.run || w.run.script !== path) return;
    const failed = w.run.failures.filter((f) => f.line !== undefined);
    if (failed.length === 0) return;
    v.dispatch(
      setDiagnostics(
        v.state,
        failed.map((f) => {
          const line = v.state.doc.line(Math.min(f.line!, v.state.doc.lines));
          return { from: line.from, to: line.to, severity: "error", message: `${f.rule} failed when run: ${f.error.trim().split("\n").at(-1)}` };
        }),
      ),
    );
  }, [w.run, path]);

  const goTo = (line: number) => {
    const v = view.current;
    if (!v) return;
    const at = v.state.doc.line(Math.min(line, v.state.doc.lines));
    v.dispatch({ selection: { anchor: at.from }, scrollIntoView: true });
    v.focus();
  };

  const dirty = saved !== source;
  const errors = check?.problems.filter((p) => p.severity === "error").length ?? 0;
  const ownRules = check?.rules.filter((r) => r.script !== "std") ?? [];
  const profiles = check?.profiles ?? [];
  const profile = profiles.find((p) => p.name === profileName);
  const rulesByName = new Map((check?.rules ?? []).map((r) => [r.name, r]));

  /** Verifies the System with another of the script's profiles from now on. */
  const choose = async (name: string) => {
    setProfileName(name);
    if (!exists || !path) return;
    try {
      await api.setAttachment(w.context, "verifier", { script: path, profile: name });
      w.notify(`The System is verified with the profile ${name} from now on`, "ok");
    } catch (e) {
      w.notify((e as Error).message, "error");
    }
  };

  return (
    <div className="editor script-editor">
      <header className="editor-header compact">
        <div className="editor-icon view">
          <Icon name="play" size={22} />
        </div>
        <div className="editor-title">
          <span className="editor-kind">Verification script · Python</span>
          <h1>{path ? <InlineText value={path} mono onCommit={setPath} /> : "…"}</h1>
          <span className="editor-summary">
            {exists ? (
              <>
                The System is verified with this script's profile <code>{profileName}</code>.
              </>
            ) : (
              "Not saved yet: the System is verified with the standard rules until it is."
            )}{" "}
            <kbd>Ctrl S</kbd> save · <kbd>Ctrl Enter</kbd> save and run · <kbd>Ctrl Space</kbd> complete
          </span>
        </div>
        <div className="editor-actions">
          {dirty && <Badge severity="warning">unsaved</Badge>}
          {errors > 0 && <Badge severity="error">{errors} error{errors === 1 ? "" : "s"}</Badge>}
          <label className="profile-picker" title="Which of the script's profiles the System is verified with">
            <span>Profile</span>
            <select value={profileName} onChange={(e) => void choose(e.target.value)} className={profile || profiles.length === 0 ? "" : "invalid-value"}>
              {!profiles.some((p) => p.name === profileName) && <option value={profileName}>{profileName} (not in the script)</option>}
              {profiles.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} — {p.rules.length} rules
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void save()} disabled={!dirty && exists}>
            <Icon name="save" /> Save
          </button>
          <button onClick={() => source !== undefined && download(path?.split("/").pop() ?? "rules.py", source, "text/x-python")} title="Download the script">
            <Icon name="download" />
          </button>
          <button className="primary" disabled={busy || errors > 0} onClick={() => void run()} title={errors > 0 ? "Fix the script's errors first" : "Save, and verify the System with this script"}>
            <Icon name="play" /> {busy ? "Running…" : "Run"}
          </button>
        </div>
      </header>
      <div className="script-body">
        <div className="code" ref={host} />
        <Splitter axis="x" size={side} grows="against" min={220} max={760} initial={320} onResize={resizeSide} onResized={keepSide} label="Resize the verification pane" />
        <aside className="script-side" style={{ width: side }}>
          <h3>Profile {profileName}</h3>
          {profile ? (
            <ul className="profile-rules">
              {profile.rules.map((name) => {
                const rule = rulesByName.get(name);
                return (
                  <li key={name} title={rule?.about}>
                    <button onClick={() => rule?.line && goTo(rule.line)} disabled={!rule?.line}>
                      <span className={`severity-dot ${rule?.severity ?? "error"}`} />
                      <code>{name}</code>
                    </button>
                    {rule?.script === "std" && <span className="muted">std</span>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="inline-problem warning">
              {profiles.length === 0 ? "The script has no profile yet." : `The script has no profile ${profileName}: choose another above.`}
            </p>
          )}
          <h3>This script's rules</h3>
          <ul className="rule-list">
            {ownRules.map((r) => (
              <li key={r.name}>
                <button onClick={() => r.line && goTo(r.line)}>
                  <Badge severity={r.severity === "error" ? "error" : "warning"}>{r.severity}</Badge> <code>{r.name}</code>
                </button>
                <p>{r.about || <span className="muted">no docstring</span>}</p>
              </li>
            ))}
            {ownRules.length === 0 && <li className="muted">None yet.</li>}
          </ul>
          <h3>Last run</h3>
          {w.run ? (
            <ul className="rule-list">
              {w.run.failures.map((f) => (
                <li key={f.rule}>
                  <button onClick={() => f.line && goTo(f.line)}>
                    <Badge severity="error">failed</Badge> <code>{f.rule}</code>
                  </button>
                  <p>{f.error.trim().split("\n").at(-1)}</p>
                </li>
              ))}
              {w.run.violations.slice(0, 30).map((v, i) => (
                <li key={i}>
                  <button onClick={() => v.subjects[0] && model.get(v.subjects[0]) && w.reveal(v.subjects[0])}>
                    <Badge severity={v.severity === "error" ? "error" : "warning"}>{v.severity}</Badge> <code>{v.rule}</code>
                  </button>
                  <p>{v.message}</p>
                </li>
              ))}
              {w.run.violations.length === 0 && w.run.failures.length === 0 && (
                <li className="ok-line">
                  <Icon name="check" /> {w.run.rules} rules, nothing found.
                </li>
              )}
            </ul>
          ) : (
            <p className="muted">Not run yet.</p>
          )}
          <p className="muted small-print">
            The script runs as Python, with <code>systemathic.core</code> and <code>systemathic.std</code>. For a full editor, open {path} in VS Code: what you save there shows here when you come back.
          </p>
        </aside>
      </div>
    </div>
  );
}

