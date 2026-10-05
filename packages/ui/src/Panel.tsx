/** The bottom panel: Problems, the shared History, and the last verification. */
import { useState } from "react";
import { RuleDoc } from "./DocumentationTab";
import { Badge, Icon } from "./widgets";
import { useModel, useWorkspace } from "./workspace";

export type PanelTab = "problems" | "history" | "verification";

export function Panel({ tab, onTab, onClose, height }: { tab: PanelTab; onTab(tab: PanelTab): void; onClose(): void; height: number }) {
  const w = useWorkspace();
  const model = useModel();
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");
  const errors = w.diagnostics.filter((d) => d.severity === "error").length;
  const shown = w.diagnostics.filter((d) => filter === "all" || d.severity === filter);
  return (
    <section className="panel" style={{ height }}>
      <nav className="panel-tabs">
        <button className={tab === "problems" ? "on" : ""} onClick={() => onTab("problems")}>
          Problems {w.diagnostics.length > 0 && <Badge severity={errors ? "error" : "warning"}>{w.diagnostics.length}</Badge>}
        </button>
        <button className={tab === "history" ? "on" : ""} onClick={() => onTab("history")}>
          History <span className="count">{w.history.length}</span>
        </button>
        <button className={tab === "verification" ? "on" : ""} onClick={() => onTab("verification")}>
          Verification {w.run && <Badge severity={w.run.errors ? "error" : "ok"}>{w.run.errors ? w.run.errors : "✓"}</Badge>}
        </button>
        <span className="spacer" />
        {tab === "problems" && (
          <div className="segmented small">
            {(["all", "error", "warning"] as const).map((f) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "error" ? "Errors" : "Warnings"}
              </button>
            ))}
          </div>
        )}
        <button className="icon-button" aria-label="Hide the panel" title="Hide the panel (Ctrl+J)" onClick={onClose}>
          <Icon name="x" />
        </button>
      </nav>
      <div className="panel-body">
        {tab === "problems" &&
          (shown.length === 0 ? (
            <p className="ok-line">
              <Icon name="check" /> {w.diagnostics.length === 0 ? "No problems. The System is well-formed." : "Nothing of this kind."}
            </p>
          ) : (
            <ul className="problem-list">
              {shown.map((d, i) => {
                const first = d.subjects.find((s) => model.get(s));
                return (
                  <li key={i} className={d.severity} onClick={() => first && w.reveal(first)} title={first ? "Show where it is" : undefined}>
                    <Icon name={d.severity === "error" ? "error" : "warning"} size={15} />
                    <span className="problem-message">{d.message}</span>
                    <span className="problem-where">{d.subjects.filter((s) => model.get(s)).slice(0, 3).map((s) => model.name(s)).join(", ")}</span>
                    <span className="problem-check">{d.kind === "rule" ? d.check : `${d.check} · structural`}</span>
                    {d.suggestions[0] && <span className="problem-fix">→ {d.suggestions[0].message}</span>}
                  </li>
                );
              })}
            </ul>
          ))}
        {tab === "history" && (
          <ol className="history-list">
            {[...w.history].reverse().map((edit) => (
              <li key={edit.id} className={edit.author === w.session ? "mine" : ""} onClick={() => edit.elements.find((e) => model.get(e)) && w.reveal(edit.elements.find((e) => model.get(e))!)}>
                <span className={`op-kind ${edit.kind}`} />
                <span className="history-id">#{edit.id}</span>
                <span className="who">{edit.author === w.session ? "you" : edit.client}</span>
                <span>{edit.summary}</span>
              </li>
            ))}
            {w.history.length === 0 && <p className="muted">No edits yet in this session of the host.</p>}
          </ol>
        )}
        {tab === "verification" &&
          (w.run ? (
            <div>
              <p className="run-summary">
                Profile <b>{w.run.profile}</b> from <code>{w.run.script}</code>: {w.run.rules} rules, <b>{w.run.errors}</b> errors, <b>{w.run.warnings}</b> warnings
                {w.run.failures.length > 0 && <>, <b>{w.run.failures.length}</b> rules failed to run</>}.
                {w.run.atEdit !== w.history.length && <span className="stale"> The System has changed since.</span>}{" "}
                <button className="small" disabled={w.structural > 0} onClick={() => void w.verify()}>
                  Verify again
                </button>
              </p>
              <ul className="problem-list">
                {w.run.violations.map((v, i) => (
                  <li key={i} className={v.severity} onClick={() => v.subjects[0] && model.get(v.subjects[0]) && w.reveal(v.subjects[0])}>
                    <Icon name={v.severity === "error" ? "error" : "warning"} size={15} />
                    <span className="problem-message">{v.message}</span>
                    <span className="problem-check" title={w.run!.profileRules?.find((r) => r.name === v.rule)?.about}>
                      {v.rule}
                    </span>
                  </li>
                ))}
                {w.run.failures.map((f, i) => (
                  <li key={`f${i}`} className="error">
                    <Icon name="error" size={15} />
                    <span className="problem-message">
                      rule <b>{f.rule}</b> failed: {f.error.trim().split("\n").at(-1)}
                    </span>
                  </li>
                ))}
              </ul>
              {w.run.profileRules && w.run.profileRules.length > 0 && (
                <details className="rules-run">
                  <summary>The {w.run.profileRules.length} rules it was verified against, and what each is for</summary>
                  <div className="rule-docs">
                    {w.run.profileRules.map((rule) => (
                      <RuleDoc key={rule.name} rule={rule} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <p className="muted">
              Not verified yet.{" "}
              <button className="small" disabled={w.structural > 0} onClick={() => void w.verify()}>
                Verify
              </button>
            </p>
          ))}
      </div>
    </section>
  );
}
