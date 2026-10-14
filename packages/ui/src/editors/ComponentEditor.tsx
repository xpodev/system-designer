/**
 * The Component editor: a Component in the order a design is thought through — the Languages
 * it defines (core ones, then extensions), the Languages it uses and what it implements, what
 * it exports (its API) and what it imports, the Interactions it offers, the Components nested
 * in it, the Transformations and Mediums it holds, and the Deployments that put it together.
 */
import { useState } from "react";
import { uniqueName } from "../Explorer";
import type { ComponentJson, FunctionJson, ImportJson, InteractionJson } from "../model";
import { Description } from "../prose";
import { AddInline, Badge, Chips, Icon, IconButton, InlineText, Marks, Menu, Picker, Section, type Choice } from "../widgets";
import { useFocusRow, useModel, useWorkspace } from "../workspace";
import { EditorHeader, Problems } from "./common";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function ComponentEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Component") return <p className="empty">This Component no longer exists.</p>;
  const c = at.component;
  const isRoot = id === model.root.id;
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
          <Section title="Implements" icon="Component" hint="the interfaces it may stand in for, wherever they are placed">
            <Chips
              values={c.implements}
              label={(x) => model.name(x)}
              icon="Component"
              choices={model.components.filter((k) => k.id !== id && !model.ancestry(id).includes(k)).map((k) => ({ id: k.id, label: k.name }))}
              onAdd={(implemented) => void w.act("ComponentEditor", "implement", { component: id, implemented })}
              onRemove={(implemented) => void w.act("ComponentEditor", "unimplement", { component: id, implemented })}
              onOpen={(x) => w.open({ kind: "component", id: x })}
              addLabel="Component"
              empty="Nothing: it is its own."
            />
          </Section>
        </div>

        <div className="two-columns">
          <Exports component={c} />
          <Imports component={c} />
        </div>

        <Section title="Interactions" icon="Interaction" count={c.interactions.length} hint="what it offers, each over one Language it uses; what it exports of them is its API">
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

/** What a Component exports: its API. Nothing else of it is reachable from outside it. */
function Exports({ component: c }: { component: ComponentJson }) {
  const w = useWorkspace();
  const model = useModel();
  const direct = new Set(c.exports.flatMap((e) => Object.entries(e).filter(([key]) => key !== "id").map(([, target]) => target)));
  const choices: Choice[] = model
    .exportable(c.id)
    .filter((x) => !direct.has(x))
    .map((x) => {
      const reexport = model.kind(x) === "Export";
      const what = reexport ? model.resolve(x) : x;
      return { id: x, label: model.name(what), hint: reexport ? `re-export, from ${model.exporter(x)?.name}` : model.kind(x) };
    });
  return (
    <Section title="Exports" icon="link" count={c.exports.length} hint="its API: what others may reach of it — its own, its children, or what they export">
      <Chips
        values={c.exports.map((e) => e.id)}
        label={(e) => exportLabel(model, e)}
        icon="link"
        choices={choices}
        onAdd={(item) => void w.act("ComponentEditor", "export", { component: c.id, item })}
        onRemove={(exported) => void w.act("ComponentEditor", "unexport", { export: exported })}
        onOpen={(e) => {
          const target = model.resolve(e);
          if (target) w.reveal(target);
        }}
        addLabel="Export"
        empty="Nothing: no other Component reaches it."
      />
    </Section>
  );
}

/** An Export as it reads: what it exports, and whose Export it re-exports. */
function exportLabel(model: ReturnType<typeof useModel>, exported: string): string {
  const at = model.get(exported);
  const again = at?.kind === "Export" ? at.export.export : undefined;
  return again === undefined ? model.name(exported) : `${model.name(exported)} (from ${model.exporter(again)?.name ?? "?"})`;
}

/** What a Component imports: from which Components, and which of their Exports it takes. */
function Imports({ component: c }: { component: ComponentJson }) {
  const w = useWorkspace();
  const model = useModel();
  const importable = model.importable(c.id);
  const from = new Set(c.imports.map((i) => i.from));
  const fresh = importable.filter((k) => !from.has(k.id));
  // Everything inside a Component it may import from, that it does not reach yet: to reach it, exported up the way.
  const reached = new Set(model.imported(c.id));
  const inside = (k: ComponentJson): ComponentJson[] => k.components.flatMap((child) => [child, ...inside(child)]);
  const reachable: Choice[] = importable
    .flatMap((k) => [k, ...inside(k)])
    .flatMap((k) => [...k.languages, ...k.interactions, ...k.transformations, ...k.mediums].map((x) => ({ x, k })))
    .filter(({ x }) => !reached.has(x.id))
    .map(({ x, k }) => ({ id: x.id, label: x.name, hint: `${model.kind(x.id)} of ${k.name}` }));
  return (
    <Section title="Imports" icon="link" count={c.imports.length} hint="what it depends on: its siblings' Exports, and what its parents import from">
      {c.imports.map((i) => (
        <ImportRow key={i.id} component={c} imported={i} />
      ))}
      <div className="new-row">
        {fresh.length > 0 && (
          <Picker
            value={undefined}
            placeholder="Import from…"
            choices={fresh.map((k) => ({ id: k.id, label: k.name }))}
            onChange={(item) => item && void w.act("ComponentEditor", "import", { component: c.id, item })}
          />
        )}
        {reachable.length > 0 && (
          <Picker
            value={undefined}
            placeholder="Reach…"
            choices={reachable}
            onChange={(item) => item && void w.act("ComponentEditor", "reach", { component: c.id, item }, { message: `Reached ${model.name(item)}, exported on the way` })}
          />
        )}
      </div>
      {c.imports.length === 0 && importable.length === 0 && <span className="muted">Nothing to import: it has no siblings, and its parents import nothing.</span>}
    </Section>
  );
}

/** One Import: the Component it is from, and the Exports it takes — none, for the Component as a whole. */
function ImportRow({ component: c, imported: i }: { component: ComponentJson; imported: ImportJson }) {
  const w = useWorkspace();
  const model = useModel();
  const from = model.component(i.from);
  const offered = (from?.exports ?? []).filter((e) => !i.exports.includes(e.id)).map((e) => ({ id: e.id, label: exportLabel(model, e.id), hint: model.kind(model.resolve(e.id) ?? "") }));
  return (
    <div className="import-row row">
      <span className="label">
        <button className="link-chip" onClick={() => w.open({ kind: "component", id: i.from })}>
          {model.name(i.from)}
        </button>
      </span>
      <Chips
        values={i.exports}
        label={(e) => exportLabel(model, e)}
        icon="link"
        choices={offered}
        onAdd={(item) => void w.act("ComponentEditor", "import", { component: c.id, item })}
        onRemove={(item) => void w.act("ComponentEditor", "unimport", { component: c.id, item })}
        onOpen={(e) => {
          const target = model.resolve(e);
          if (target) w.reveal(target);
        }}
        addLabel="Export"
        empty="the Component as a whole"
      />
      <Marks diagnostics={w.about(i.id)} />
      <IconButton icon="x" label={`Stop importing from ${model.name(i.from)}`} onClick={() => void w.act("ComponentEditor", "unimport", { component: c.id, item: i.from })} />
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
  const exported = component.exports.some((e) => e.interaction === i.id);
  return (
    <div ref={ref} className={`interaction-card row ${problems.length ? "has-problems" : ""}`}>
      <div className="signature">
        <Icon name="Interaction" />
        <InlineText className="interaction-name" value={i.name} onCommit={(name) => void w.act("FunctionEditor", "rename", { item: i.id, name })} />
        <Signature f={i} entities={entities} />
        <span className="muted">over</span>
        <Picker
          value={i.language}
          choices={component.uses.map((l) => ({ id: l, label: model.name(l) }))}
          onChange={(language) => language && void w.act("InteractionEditor", "setLanguage", { interaction: i.id, language })}
        />
        {exported ? <Badge severity="info">exported</Badge> : <span className="muted" title="Only the Components nested in this one reach it">internal</span>}
        <span className="row-tail">
          <Marks diagnostics={problems} />
          <IconButton icon="trash" label="Delete Interaction" onClick={() => void w.act("FunctionEditor", "remove", { function: i.id }, { message: `Deleted Interaction ${i.name}` })} />
        </span>
      </div>
      <Description id={i.id} className="row-description" />
    </div>
  );
}

/** A Function's Parameters, each with its Entity, and its output, or none: edited through the FunctionEditor. */
export function Signature({ f, entities, outputs = entities }: { f: FunctionJson; entities: Choice[]; outputs?: Choice[] }) {
  const w = useWorkspace();
  return (
    <>
      <span className="paren">(</span>
      {f.parameters.map((p, index) => (
        <span key={p.id} className="parameter">
          <InlineText value={p.name} onCommit={(name) => void w.act("FunctionEditor", "rename", { item: p.id, name })} />
          <span className="colon">:</span>
          <Picker value={p.type} choices={entities} onChange={(type) => type && void w.act("FunctionEditor", "setType", { parameter: p.id, type })} />
          <span className="parameter-tools">
            {index > 0 && <IconButton icon="up" label="Move earlier" onClick={() => void w.act("FunctionEditor", "moveParameter", { parameter: p.id, position: index - 1 }, { quiet: true })} />}
            {index < f.parameters.length - 1 && (
              <IconButton icon="down" label="Move later" onClick={() => void w.act("FunctionEditor", "moveParameter", { parameter: p.id, position: index + 1 }, { quiet: true })} />
            )}
            <IconButton icon="x" label="Remove Parameter" onClick={() => void w.act("FunctionEditor", "removeParameter", { parameter: p.id })} />
          </span>
          {index < f.parameters.length - 1 && <span className="comma">,</span>}
        </span>
      ))}
      {entities.length > 0 && (
        <button
          className="add-parameter"
          title="Add a Parameter"
          onClick={() => {
            const type = entities[0]!;
            const used = new Set(f.parameters.map((p) => p.name));
            let name = lowerFirst(type.label);
            for (let n = 2; used.has(name); n++) name = `${lowerFirst(type.label)}${n}`;
            void w.act("FunctionEditor", "addParameter", { function: f.id, name, type: type.id }, { quiet: true });
          }}
        >
          <Icon name="plus" size={12} />
        </button>
      )}
      <span className="paren">)</span>
      <span className="arrow">→</span>
      <Picker
        value={f.output ?? undefined}
        allowNone
        placeholder="nothing"
        choices={outputs}
        onChange={(output) => void w.act("FunctionEditor", "setOutput", output ? { function: f.id, output } : { function: f.id })}
      />
    </>
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
  const problems = [...w.about(id), ...t.parameters.flatMap((p) => w.about(p.id))];
  return (
    <div ref={ref} className="transformation-row row" onClick={() => w.open({ kind: "transformation", id })}>
      <Icon name="Transformation" />
      <span className="cell-main">{t.name}</span>
      <span className="muted">{model.crossing(t)}</span>
      <span className="mono muted">{model.signature(t)}</span>
      {problems.length > 0 && <Badge severity={problems.some((p) => p.severity === "error") ? "error" : "warning"}>{problems.length}</Badge>}
      <IconButton icon="chevron" label="Open" onClick={() => w.open({ kind: "transformation", id })} />
    </div>
  );
}

function NewTransformation({ component, languages }: { component: string; languages: string[] }) {
  const w = useWorkspace();
  const model = useModel();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>();
  const [output, setOutput] = useState<string>();
  // Any Entity of a Language it uses: an input of one, and an output of another.
  const choices = [...new Set(languages.flatMap((l) => model.vocabEntities(l)))].map((e) => ({ id: e.id, label: e.name, hint: model.languageOf(e.id)?.name }));
  const across = input !== undefined && output !== undefined && model.languageOf(input)?.id !== model.languageOf(output)?.id;
  if (!open)
    return (
      <button className="add-inline" onClick={() => setOpen(true)} disabled={languages.length === 0} title={languages.length === 0 ? "Use Languages first" : undefined}>
        <Icon name="plus" /> Transformation
      </button>
    );
  const create = async () => {
    if (!input || !output) return;
    const name = `${model.languageOf(input)?.name ?? "?"} as ${model.languageOf(output)?.name ?? "?"}`;
    const edit = await w.act("ComponentEditor", "addTransformation", { component, name, input, output }, { quiet: true });
    setOpen(false);
    setInput(undefined);
    setOutput(undefined);
    if (edit) w.open({ kind: "transformation", id: edit.elements[0]! });
  };
  return (
    <div className="new-row new-transformation">
      From <Picker value={input} choices={choices} placeholder="an input Entity" onChange={setInput} /> to{" "}
      <Picker value={output} choices={choices} placeholder="an output Entity, of another Language" onChange={setOutput} />
      <button className="primary" disabled={!across} title={across ? undefined : "The output is of another Language than the input"} onClick={create}>
        Create
      </button>
      <button onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
