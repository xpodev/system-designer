/** The System overview: its health at a glance, its Languages, Domains and Mediations, and where to start. */
import { useState } from "react";
import { uniqueName } from "../Explorer";
import { Badge, Icon, Picker, Section } from "../widgets";
import { useFocusRow, useModel, useWorkspace } from "../workspace";
import { EditorHeader } from "./common";

export function SystemEditor(props: { onCatalog(): void }) {
  const w = useWorkspace();
  const model = useModel();
  const system = model.system;
  const errors = w.diagnostics.filter((d) => d.severity === "error");
  const warnings = w.diagnostics.length - errors.length;
  const empty = model.languages.length === 0 && model.domains.length === 0;
  const taken = [...model.languages.map((l) => l.name), ...model.domains.map((d) => d.name)];

  const add = async (operation: "addLanguage" | "addDomain", what: string) => {
    const edit = await w.act("SystemEditor", operation, { system: system.id, name: uniqueName(what, taken) }, { quiet: true });
    if (edit) w.reveal(edit.elements[0]!);
  };

  return (
    <div className="editor">
      <EditorHeader
        icon="System"
        kind="System"
        id={system.id}
        name={system.name}
        onRename={(name) => void w.act("SystemEditor", "rename", { system: system.id, name })}
        summary={w.info?.path ?? "not saved to a file yet"}
        actions={
          <button onClick={props.onCatalog}>
            <Icon name="catalog" /> Import from catalog
          </button>
        }
      />
      <div className="editor-body">
        <div className="health">
          <div className={`health-card ${w.structural ? "bad" : "good"}`}>
            <Icon name={w.structural ? "error" : "check"} size={22} />
            <div>
              <strong>{w.structural ? `${w.structural} structural error${w.structural === 1 ? "" : "s"}` : "Well-formed"}</strong>
              <span>{w.structural ? "Solve them before verifying: see Problems below." : "Every condition of the core holds."}</span>
            </div>
          </div>
          <div className={`health-card ${w.run ? (w.run.errors ? "bad" : "good") : ""}`}>
            <Icon name="play" size={22} />
            <div>
              <strong>{w.run ? `${w.run.errors} rule error${w.run.errors === 1 ? "" : "s"}, ${w.run.warnings} warning${w.run.warnings === 1 ? "" : "s"}` : "Not verified"}</strong>
              <span>
                {w.run ? `${w.run.profile}, ${w.run.rules} rules${w.run.atEdit !== w.history.length ? " — the System has changed since" : ""}` : "Check the design against its rules."}
              </span>
            </div>
            <button disabled={w.structural > 0} onClick={() => void w.verify()}>
              Verify
            </button>
          </div>
          <div className="health-card">
            <Icon name="Language" size={22} />
            <div>
              <strong>
                {model.languages.length} Languages · {model.domains.length} Domains · {model.mediations.length} Mediations
              </strong>
              <span>
                {errors.length} errors, {warnings} warnings in all
              </span>
            </div>
          </div>
        </div>

        {empty && (
          <div className="getting-started">
            <h2>Start with a vocabulary</h2>
            <ol>
              <li>
                <strong>Add a Language</strong>: a closed vocabulary — the Entities a part of your system knows, and how they relate.
              </li>
              <li>
                <strong>Add a Domain</strong> that uses it: a bounded context, the unit a team or a module owns.
              </li>
              <li>
                <strong>Cross explicitly</strong>: Transformations show how one Language appears in another; Mediations say which "what" is carried out over which "how".
              </li>
            </ol>
            <div className="row-buttons start">
              <button className="primary" onClick={() => void add("addLanguage", "Language")}>
                <Icon name="plus" /> Add a Language
              </button>
              <button onClick={props.onCatalog}>Or import one from the catalog</button>
            </div>
          </div>
        )}

        <div className="three-columns">
          <Section title="Languages" icon="Language" count={model.languages.length} actions={<button className="small" onClick={() => void add("addLanguage", "Language")}>+ Language</button>}>
            <ul className="card-list">
              {model.languages.map((l) => (
                <li key={l.id}>
                  <button onClick={() => w.open({ kind: "language", id: l.id })}>
                    <span className="card-title">{l.name}</span>
                    <span className="muted">
                      {l.entities.length} entities, {l.interactions.length} interactions
                    </span>
                    {w.about(l.id).length > 0 && <Badge severity="error">{w.about(l.id).length}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Domains" icon="Domain" count={model.domains.length} actions={<button className="small" onClick={() => void add("addDomain", "Domain")}>+ Domain</button>}>
            <ul className="card-list">
              {model.domains.map((d) => (
                <li key={d.id}>
                  <button onClick={() => w.open({ kind: "domain", id: d.id })}>
                    <span className="card-title">{d.name}</span>
                    <span className="muted">uses {d.languages.map((l) => model.name(l)).join(", ") || "nothing yet"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Mediations" icon="Mediation" count={model.mediations.length}>
            <ul className="card-list">
              {model.mediations.map((m) => (
                <li key={m.id}>
                  <button onClick={() => w.open({ kind: "mediation", id: m.id })}>
                    <span className="card-title">{model.name(m.id)}</span>
                    <span className="muted">by {model.name(m.mediator)}</span>
                    {model.witnesses(m).length === 0 && <Badge severity="error">no witness</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            <NewMediation />
          </Section>
        </div>
      </div>
    </div>
  );
}

function NewMediation() {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow("#new-mediation");
  const [what, setWhat] = useState<string>();
  const [how, setHow] = useState<string>();
  const [mediator, setMediator] = useState<string>();
  if (model.domains.length < 2) return <p className="muted">A Mediation relates Domains: add at least two.</p>;
  const domains = model.domains.map((d) => ({ id: d.id, label: d.name }));
  const create = async () => {
    if (!what || !how || !mediator) return;
    const edit = await w.act("SystemEditor", "addMediation", { system: model.system.id, what, how, mediator }, { quiet: true });
    if (edit) w.open({ kind: "mediation", id: edit.elements[0]! });
  };
  return (
    <div ref={ref} className="new-mediation">
      <Picker value={what} choices={domains} placeholder="what" onChange={setWhat} />
      <span className="muted">over</span>
      <Picker value={how} choices={domains} placeholder="how" onChange={setHow} />
      <span className="muted">by</span>
      <Picker value={mediator} choices={domains} placeholder="mediator" onChange={setMediator} />
      <button className="primary small" disabled={!what || !how || !mediator} onClick={create}>
        Add Mediation
      </button>
    </div>
  );
}
