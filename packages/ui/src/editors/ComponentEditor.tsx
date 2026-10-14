/**
 * The Component editor: a Component in the order a design is thought through — the Languages
 * it defines (core ones, then extensions), the Languages it uses and what it imports, the
 * Interactions it offers, the Components nested in it, the Transformations and Mediums it
 * holds, and the Deployments that put it together.
 */
import { useState } from "react";
import { uniqueName } from "../Explorer";
import type { ComponentJson, ImportKind, InteractionJson } from "../model";
import { Description } from "../prose";
import { AddInline, Badge, Chips, Icon, IconButton, InlineText, Marks, Menu, Picker, Section, type Choice } from "../widgets";
import { useFocusRow, useModel, useWorkspace } from "../workspace";
import { EditorHeader, Problems } from "./common";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const IMPORTS: { kind: ImportKind; label: string; icon: string; editor: string; operation: string; unimport: string; arg: string }[] = [
  { kind: "components", label: "Components", icon: "Component", editor: "ComponentEditor", operation: "import", unimport: "unimport", arg: "item" },
  { kind: "interactions", label: "Interactions", icon: "Interaction", editor: "InteractionEditor", operation: "importInteraction", unimport: "unimportInteraction", arg: "interaction" },
  { kind: "transformations", label: "Transformations", icon: "Transformation", editor: "ComponentEditor", operation: "import", unimport: "unimport", arg: "item" },
  { kind: "mediums", label: "Mediums", icon: "Medium", editor: "MediumEditor", operation: "importMedium", unimport: "unimportMedium", arg: "medium" },
];

export function ComponentEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Component") return <p className="empty">This Component no longer exists.</p>;
  const c = at.component;
  const isRoot = id === model.system.root;
  const isPackage = !at.parent && !isRoot;
  const ancestry = model.ancestry(id).slice(1).reverse();
  const scope = model.scope(id);
  const taken = [...model.byId.keys()].map((x) => model.name(x));
  const add = async (editor: string, operation: string, args: Record<string, unknown>) => {
    const edit = await w.act(editor, operation, args, { quiet: true });
    if (edit) w.reveal(edit.elements[0]!);
  };

  return (
    <div className="editor">
      <EditorHeader
        icon={isPackage ? "Package" : "Component"}
        kind={isRoot ? "Component · the root" : isPackage ? "Component · package" : "Component"}
        id={id}
        name={c.name}
        onRename={(name) => void w.act("ComponentEditor", "rename", { component: id, name })}
        summary={
          ancestry.length > 0 ? (
            <span className="breadcrumb">
              {ancestry.map((a) => (
                <span key={a.id}>
                  <button className="link-chip" onClick={() => w.open({ kind: "component", id: a.id })}>
                    {a.name}
                  </button>{" "}
                  ›{" "}
                </span>
              ))}
              {c.name}
            </span>
          ) : isPackage ? (
            "brought in beside the root"
          ) : (
            "everything the design says is inside it"
          )
        }
        actions={
          !isRoot && (
            <Menu items={[{ label: "Delete Component", icon: "trash", danger: true, onSelect: () => void w.act("ComponentEditor", "remove", { component: id }, { message: `Deleted Component ${c.name}` }) }]} />
          )
        }
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Component: what it is for, and what it implements" />
        <Problems ids={[id]} />

        <Section title="Languages" icon="Language" count={c.languages.length} hint="the vocabularies it defines: core Languages, then extensions">
          <ul className="card-list">
            {c.languages.map((l) => {
              const extendsOwn = l.extends.some((x) => c.languages.some((own) => own.id === x));
              return (
                <li key={l.id}>
                  <button onClick={() => w.open({ kind: "language", id: l.id })}>
                    <Icon name="Language" size={14} />
                    <span className="card-title">{l.name}</span>
                    <Badge severity={extendsOwn ? "info" : "ok"}>{extendsOwn ? "extension" : "core"}</Badge>
                    <span className="muted">
                      {l.extends.length ? `extends ${l.extends.map((x) => model.name(x)).join(", ")} · ` : ""}
                      {l.entities.length} entities
                    </span>
                    <Marks diagnostics={w.about(l.id)} />
                  </button>
                </li>
              );
            })}
          </ul>
          <AddInline label="Language" placeholder="Name, then Enter — e.g. Combat" onAdd={(name) => void add("ComponentEditor", "addLanguage", { component: id, name })} />
        </Section>

        <div className="two-columns">
          <Section title="Uses" icon="Language" hint="the Languages it works in">
            <Chips
              values={c.uses}
              label={(l) => model.name(l)}
              icon="Language"
              choices={[...scope].map(([l, owner]) => ({ id: l, label: model.name(l), hint: owner.id === id ? undefined : `of ${owner.name}` }))}
              onAdd={(language) => void w.act("ComponentEditor", "use", { component: id, language })}
              onRemove={(language) => void w.act("ComponentEditor", "unuse", { component: id, language })}
              onOpen={(language) => w.open({ kind: "language", id: language })}
              addLabel="Language"
              empty="No Language yet."
            />
          </Section>
          <Section title="Imports" icon="link" hint="what it depends on: its siblings', and what its parents import">
            {IMPORTS.map((k) => {
              const values = c.imports[k.kind];
              const choices = model.importable(id, k.kind).map((x) => ({ id: x, label: model.name(x), hint: model.componentOf(x)?.id === x ? undefined : `of ${model.componentOf(x)?.name}` }));
              if (values.length === 0 && choices.length === 0) return null;
              return (
                <div key={k.kind} className="import-row">
                  <span className="label">{k.label}</span>
                  <Chips
                    values={values}
                    label={(x) => model.name(x)}
                    icon={k.icon}
                    choices={choices}
                    onAdd={(x) => void w.act(k.editor, k.operation, { component: id, [k.arg]: x })}
                    onRemove={(x) => void w.act(k.editor, k.unimport, { component: id, [k.arg]: x })}
                    onOpen={(x) => w.reveal(x)}
                    addLabel={k.label.slice(0, -1)}
                  />
                </div>
              );
            })}
            {IMPORTS.every((k) => c.imports[k.kind].length === 0 && model.importable(id, k.kind).length === 0) && <span className="muted">Nothing to import: it has no siblings, and its parents import nothing.</span>}
          </Section>
        </div>

        <Section title="Interactions" icon="Interaction" count={c.interactions.length} hint="its API: what it offers, each over one Language it uses">
          {c.interactions.map((i) => (
            <InteractionCard key={i.id} interaction={i} component={c} />
          ))}
          {c.uses.length === 0 ? (
            <p className="muted">Use a Language first: an Interaction is over one.</p>
          ) : (
            <NewInteraction component={c} />
          )}
        </Section>

        <Section title="Components" icon="Component" count={c.components.length} hint="nested in it: each an implementation detail of it">
          <ul className="card-list">
            {c.components.map((child) => (
              <li key={child.id}>
                <button onClick={() => w.open({ kind: "component", id: child.id })}>
                  <Icon name="Component" size={14} />
                  <span className="card-title">{child.name}</span>
                  <span className="muted">
                    uses {child.uses.map((l) => model.name(l)).join(", ") || "nothing yet"}
                    {child.interactions.length ? ` · offers ${child.interactions.map((i) => i.name).join(", ")}` : ""}
                  </span>
                  <Marks diagnostics={w.about(child.id)} />
                </button>
              </li>
            ))}
          </ul>
          <AddInline label="Component" placeholder="Name, then Enter — e.g. Server" onAdd={(name) => void add("ComponentEditor", "addComponent", { parent: id, name })} />
        </Section>

        <Section title="Transformations" icon="Transformation" count={c.transformations.length} hint="how the things of one Language appear in another">
          {c.transformations.map((t) => (
            <TransformationRow key={t.id} id={t.id} />
          ))}
          <NewTransformation component={id} languages={c.uses} />
        </Section>

        <Section title="Mediums" icon="Medium" count={c.mediums.length} hint="what a What can be passed over: a Language, and a call through it">
          {c.mediums.map((m) => (
            <MediumRow key={m.id} id={m.id} component={c} />
          ))}
          {c.uses.length === 0 ? (
            <p className="muted">Use a Language first: a Medium is over one.</p>
          ) : (
            <AddInline label="Medium" placeholder="Name, then Enter — e.g. HTTP" onAdd={(name) => void w.act("MediumEditor", "addMedium", { component: id, name, language: c.uses[0] })} />
          )}
        </Section>

        <Section title="Deployments" icon="Deployment" count={c.deployments.length} hint="ways to put it together: its parts, and how they reach each other">
          <ul className="card-list">
            {c.deployments.map((d) => (
              <li key={d.id}>
                <button onClick={() => w.open({ kind: "deployment", id: d.id })}>
                  <Icon name="Deployment" size={14} />
                  <span className="card-title">{d.name}</span>
                  <span className="muted">
                    {d.instances.map((i) => i.name).join(", ") || "nothing placed yet"} · {d.connections.length} connection{d.connections.length === 1 ? "" : "s"}
                  </span>
                  <Marks diagnostics={[...w.about(d.id), ...d.connections.flatMap((x) => w.about(x.id))]} />
                </button>
              </li>
            ))}
          </ul>
          <button className="add-inline" onClick={() => void add("DeploymentEditor", "addDeployment", { component: id, name: uniqueName("Deployment", taken) })}>
            <Icon name="plus" /> Deployment
          </button>
        </Section>
      </div>
    </div>
  );
}

function NewInteraction({ component }: { component: ComponentJson }) {
  const w = useWorkspace();
  const model = useModel();
  const [language, setLanguage] = useState(component.uses[0]);
  const entities = language ? model.vocabEntities(language) : [];
  return (
    <div className="new-row">
      <AddInline
        label="Interaction"
        placeholder="Name, then Enter — e.g. attack"
        onAdd={async (name) => {
          if (!language || entities.length === 0) return;
          const edit = await w.act("InteractionEditor", "addInteraction", { component: component.id, language, name, output: entities[0]!.id }, { quiet: true });
          if (edit) w.reveal(edit.elements[0]!);
        }}
      />
      <span className="muted">over</span>
      <Picker value={language} choices={component.uses.map((l) => ({ id: l, label: model.name(l) }))} onChange={(l) => l && setLanguage(l)} />
      {language && entities.length === 0 && <span className="inline-problem warning">{model.name(language)} has no Entity yet</span>}
    </div>
  );
}

/** An Interaction, written as its signature: its name, its Parameters each with its Entity, its output, over its Language. */
function InteractionCard({ interaction, component }: { interaction: InteractionJson; component: ComponentJson }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(interaction.id);
  const i = interaction;
  const entities: Choice[] = model.vocabEntities(i.language).map((e) => ({ id: e.id, label: e.name }));
  const problems = [...w.about(i.id), ...i.parameters.flatMap((p) => w.about(p.id))];
  return (
    <div ref={ref} className={`interaction-card row ${problems.length ? "has-problems" : ""}`}>
      <div className="signature">
        <Icon name="Interaction" />
        <InlineText className="interaction-name" value={i.name} onCommit={(name) => void w.act("InteractionEditor", "rename", { item: i.id, name })} />
        <span className="paren">(</span>
        {i.parameters.map((p, index) => (
          <span key={p.id} className={`parameter ${i.primary === p.id ? "primary" : ""}`}>
            <button
              className="star"
              title={i.primary === p.id ? "The primary Parameter: this is an Action on it (click to unset)" : "Make this the primary Parameter (an Action)"}
              onClick={() => void w.act("StdEditor", "setPrimary", i.primary === p.id ? { interaction: i.id } : { interaction: i.id, parameter: p.id })}
            >
              <Icon name="star" size={12} />
            </button>
            <InlineText value={p.name} onCommit={(name) => void w.act("InteractionEditor", "rename", { item: p.id, name })} />
            <span className="colon">:</span>
            <Picker value={p.type} choices={entities} onChange={(type) => type && void w.act("InteractionEditor", "setType", { parameter: p.id, type })} />
            <span className="parameter-tools">
              {index > 0 && <IconButton icon="up" label="Move earlier" onClick={() => void w.act("InteractionEditor", "moveParameter", { parameter: p.id, position: index - 1 }, { quiet: true })} />}
              {index < i.parameters.length - 1 && (
                <IconButton icon="down" label="Move later" onClick={() => void w.act("InteractionEditor", "moveParameter", { parameter: p.id, position: index + 1 }, { quiet: true })} />
              )}
              <IconButton icon="x" label="Remove Parameter" onClick={() => void w.act("InteractionEditor", "removeParameter", { parameter: p.id })} />
            </span>
            {index < i.parameters.length - 1 && <span className="comma">,</span>}
          </span>
        ))}
        {entities.length > 0 && (
          <button
            className="add-parameter"
            title="Add a Parameter"
            onClick={() => {
              const type = entities[0]!;
              const used = new Set(i.parameters.map((p) => p.name));
              let name = lowerFirst(type.label);
              for (let n = 2; used.has(name); n++) name = `${lowerFirst(type.label)}${n}`;
              void w.act("InteractionEditor", "addParameter", { interaction: i.id, name, type: type.id }, { quiet: true });
            }}
          >
            <Icon name="plus" size={12} />
          </button>
        )}
        <span className="paren">)</span>
        <span className="arrow">→</span>
        <Picker value={i.output} choices={entities} onChange={(output) => output && void w.act("InteractionEditor", "setOutput", { interaction: i.id, output })} />
        <span className="muted">over</span>
        <Picker
          value={i.language}
          choices={component.uses.map((l) => ({ id: l, label: model.name(l) }))}
          onChange={(language) => language && void w.act("InteractionEditor", "setLanguage", { interaction: i.id, language })}
        />
        {i.primary && <Badge severity="info">Action</Badge>}
        <span className="row-tail">
          <Marks diagnostics={problems} />
          <IconButton icon="trash" label="Delete Interaction" onClick={() => void w.act("InteractionEditor", "remove", { interaction: i.id }, { message: `Deleted Interaction ${i.name}` })} />
        </span>
      </div>
      <Description id={i.id} className="row-description" />
    </div>
  );
}

function MediumRow({ id, component }: { id: string; component: ComponentJson }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(id);
  const medium = component.mediums.find((m) => m.id === id)!;
  const calls = component.interactions.filter((i) => i.language === medium.language).map((i) => ({ id: i.id, label: `${i.name}()` }));
  const entities = model.vocabEntities(medium.language);
  return (
    <div ref={ref} className={`medium-row row ${w.about(id).length ? "has-problems" : ""}`}>
      <Icon name="Medium" />
      <InlineText className="cell-main" value={medium.name} onCommit={(name) => void w.act("MediumEditor", "rename", { medium: id, name })} />
      <span className="muted">over</span>
      <Picker value={medium.language} choices={component.uses.map((l) => ({ id: l, label: model.name(l) }))} onChange={(language) => language && void w.act("MediumEditor", "setLanguage", { medium: id, language })} />
      <span className="muted">through</span>
      {calls.length > 0 ? (
        <Picker value={medium.call || undefined} choices={calls} placeholder="its call" onChange={(call) => call && void w.act("MediumEditor", "setCall", { medium: id, call })} />
      ) : entities.length > 0 ? (
        <button className="small" onClick={() => void w.act("MediumEditor", "createCall", { medium: id, name: "send", output: entities[0]!.id }, { message: "Created the call send(): give it its Parameters" })}>
          <Icon name="plus" /> Create its call
        </button>
      ) : (
        <span className="inline-problem warning">{model.name(medium.language)} has no Entity for a call yet</span>
      )}
      <span className="row-tail">
        <Marks diagnostics={w.about(id)} />
        <IconButton icon="trash" label="Delete Medium" onClick={() => void w.act("MediumEditor", "remove", { medium: id }, { message: `Deleted Medium ${medium.name}` })} />
      </span>
      <Description id={id} className="row-description" />
    </div>
  );
}

function TransformationRow({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(id);
  const at = model.get(id);
  if (at?.kind !== "Transformation") return null;
  const t = at.transformation;
  const source = model.language(t.source);
  const items = source ? source.entities.length + source.relationships.length : 0;
  const covered = t.entityMappings.length + t.relationshipMappings.length + t.deferred.length;
  const problems = w.diagnostics.filter((d) => d.subjects.some((s) => s === id || s.startsWith(`${id}#`)));
  return (
    <div ref={ref} className="transformation-row row" onClick={() => w.open({ kind: "transformation", id })}>
      <Icon name="Transformation" />
      <span className="cell-main">{t.name}</span>
      <span className="muted">
        {model.name(t.source)} → {model.name(t.target)}
      </span>
      <span className="coverage-mini" title={`${covered} of ${items} source items mapped or deferred`}>
        <span style={{ width: `${items ? (100 * Math.min(covered, items)) / items : 100}%` }} />
      </span>
      {problems.length > 0 && <Badge severity={problems.some((p) => p.severity === "error") ? "error" : "warning"}>{problems.length}</Badge>}
      <IconButton icon="chevron" label="Open" onClick={() => w.open({ kind: "transformation", id })} />
    </div>
  );
}

function NewTransformation({ component, languages }: { component: string; languages: string[] }) {
  const w = useWorkspace();
  const model = useModel();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>();
  const [target, setTarget] = useState<string>();
  const choices = languages.map((l) => ({ id: l, label: model.name(l) }));
  if (!open)
    return (
      <button className="add-inline" onClick={() => setOpen(true)} disabled={languages.length === 0} title={languages.length === 0 ? "Use Languages first" : undefined}>
        <Icon name="plus" /> Transformation
      </button>
    );
  const create = async () => {
    if (!source || !target) return;
    const name = `${model.name(source)} as ${model.name(target)}`;
    const edit = await w.act("ComponentEditor", "addTransformation", { component, name, source, target }, { quiet: true });
    setOpen(false);
    setSource(undefined);
    setTarget(undefined);
    if (edit) w.open({ kind: "transformation", id: edit.elements[0]! });
  };
  return (
    <div className="new-row new-transformation">
      From <Picker value={source} choices={choices} placeholder="source Language" onChange={setSource} /> to{" "}
      <Picker value={target} choices={choices} placeholder="target Language" onChange={setTarget} />
      <button className="primary" disabled={!source || !target} onClick={create}>
        Create
      </button>
      <button onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
