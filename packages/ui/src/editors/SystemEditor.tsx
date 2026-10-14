/** The System overview: its health at a glance, its root and the packages beside it, its Configurations, and where to start. */
import { useState } from "react";
import { uniqueName } from "../Explorer";
import type { ComponentJson } from "../model";
import { Badge, Icon, Marks, Picker, Section } from "../widgets";
import { useModel, useWorkspace } from "../workspace";
import { Description } from "../prose";
import { EditorHeader } from "./common";

export function SystemEditor(props: { onCatalog(): void }) {
  const w = useWorkspace();
  const model = useModel();
  const system = model.system;
  const root = model.root;
  const errors = w.diagnostics.filter((d) => d.severity === "error");
  const warnings = w.diagnostics.length - errors.length;
  const components = model.components.length;
  const deployments = model.components.reduce((n, c) => n + c.deployments.length, 0);
  const empty = root !== undefined && root.languages.length === 0 && root.components.length === 0;
  const taken = [...model.byId.keys()].map((id) => model.name(id));

  const add = async (editor: string, operation: string, args: Record<string, unknown>, what: string) => {
    const edit = await w.act(editor, operation, { ...args, name: uniqueName(what, taken) }, { quiet: true });
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
        <Description id={system.id} className="about" invite="Describe this System: what it is, and what it is for" />
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
            <Icon name="Component" size={22} />
            <div>
              <strong>
                {components} Component{components === 1 ? "" : "s"} · {model.languages.length} Language{model.languages.length === 1 ? "" : "s"} · {deployments} Deployment{deployments === 1 ? "" : "s"}
              </strong>
              <span>
                {errors.length} errors, {warnings} warnings in all
              </span>
            </div>
          </div>
        </div>

        {empty && root && (
          <div className="getting-started">
            <h2>Design it as you think it through</h2>
            <ol>
              <li>
                <strong>Core Languages</strong> define the concepts: closed vocabularies, each at one level of abstraction.
              </li>
              <li>
                <strong>Extensions</strong> give them depth: Languages that build on others, adding Entities and Relationships.
              </li>
              <li>
                <strong>Components</strong> give them an implementation: each uses Languages, offers Interactions, imports what it depends on — and is built the same way inside.
              </li>
              <li>
                <strong>Deployments</strong> say how a Component is put together: which parts exist, how they reach each other, and over what.
              </li>
            </ol>
            <div className="row-buttons start">
              <button className="primary" onClick={() => void add("ComponentEditor", "addLanguage", { component: root.id }, "Language")}>
                <Icon name="plus" /> Add a core Language
              </button>
              <button onClick={props.onCatalog}>Or import a package from the catalog</button>
            </div>
          </div>
        )}

        <div className="three-columns">
          <Section title="The root" icon="Component" hint="everything the design says is inside it">
            {root && (
              <ul className="card-list">
                <ComponentCard component={root} />
                {root.components.map((c) => (
                  <ComponentCard key={c.id} component={c} nested />
                ))}
              </ul>
            )}
            {root && (
              <div className="row-buttons start">
                <button className="small" onClick={() => void add("ComponentEditor", "addLanguage", { component: root.id }, "Language")}>
                  + Language
                </button>
                <button className="small" onClick={() => void add("ComponentEditor", "addComponent", { parent: root.id }, "Component")}>
                  + Component
                </button>
              </div>
            )}
          </Section>
          <Section title="Packages" icon="Package" count={model.packages.length} hint="brought in beside the root" actions={<button className="small" onClick={props.onCatalog}>+ From the catalog</button>}>
            <ul className="card-list">
              {model.packages.map((c) => (
                <ComponentCard key={c.id} component={c} />
              ))}
            </ul>
            {model.packages.length === 0 && <p className="muted">None yet. The root imports from them as from siblings.</p>}
          </Section>
          <Section title="Configurations" icon="Configuration" count={model.configurations.length} hint="the whole System, put together">
            <ul className="card-list">
              {model.configurations.map((c) => (
                <li key={c.id}>
                  <button onClick={() => w.open({ kind: "configuration", id: c.id })}>
                    <span className="card-title">{c.name}</span>
                    <span className="muted">the root as {model.name(c.root.deployment)}</span>
                    <Marks diagnostics={w.about(c.id)} />
                  </button>
                </li>
              ))}
            </ul>
            <NewConfiguration />
          </Section>
        </div>
      </div>
    </div>
  );
}

function ComponentCard({ component, nested }: { component: ComponentJson; nested?: boolean }) {
  const w = useWorkspace();
  const model = useModel();
  const problems = w.about(component.id);
  return (
    <li className={nested ? "nested" : ""}>
      <button onClick={() => w.open({ kind: "component", id: component.id })}>
        <Icon name={nested ? "Component" : model.packages.includes(component) ? "Package" : "Component"} size={14} />
        <span className="card-title">{component.name}</span>
        <span className="muted">
          {component.languages.length ? `${component.languages.map((l) => l.name).join(", ")} · ` : ""}
          {component.interactions.length} interaction{component.interactions.length === 1 ? "" : "s"}
        </span>
        {problems.length > 0 && <Badge severity="error">{problems.length}</Badge>}
      </button>
    </li>
  );
}

function NewConfiguration() {
  const w = useWorkspace();
  const model = useModel();
  const [deployment, setDeployment] = useState<string>();
  const options = model.root?.deployments ?? [];
  if (options.length === 0) return <p className="muted">A Configuration starts with a Deployment of the root: add one first.</p>;
  const taken = model.configurations.map((c) => c.name);
  return (
    <div className="new-mediation">
      <Picker value={deployment} choices={options.map((d) => ({ id: d.id, label: d.name }))} placeholder="the root as…" onChange={setDeployment} />
      <button
        className="primary small"
        disabled={!deployment}
        onClick={async () => {
          const edit = await w.act("ConfigurationEditor", "addConfiguration", { system: model.system.id, name: uniqueName("Configuration", taken), deployment }, { quiet: true });
          if (edit) w.open({ kind: "configuration", id: edit.elements[0]! });
        }}
      >
        Add Configuration
      </button>
    </div>
  );
}
