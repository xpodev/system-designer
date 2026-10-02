/** The Domain editor: what a Domain uses and references, what that puts in its scope, and the Transformations it holds. */
import { useState } from "react";
import { Badge, Chips, Icon, IconButton, Menu, Picker, Section } from "../widgets";
import { useFocusRow, useModel, useWorkspace } from "../workspace";
import { EditorHeader, Problems } from "./common";

export function DomainEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Domain") return <p className="empty">This Domain no longer exists.</p>;
  const domain = at.domain;
  const scope = model.scope(id);
  const roles = model.rolesOf(id);

  return (
    <div className="editor">
      <EditorHeader
        icon="Domain"
        kind={roles.some((r) => r.role === "mediator") ? "Domain · mediator" : "Domain"}
        id={id}
        name={domain.name}
        onRename={(name) => void w.act("DomainEditor", "rename", { domain: id, name })}
        summary={
          <>
            {scope.size} Language{scope.size === 1 ? "" : "s"} in scope · {domain.transformations.length} Transformation{domain.transformations.length === 1 ? "" : "s"}
          </>
        }
        actions={
          <Menu
            items={[{ label: "Delete Domain", icon: "trash", danger: true, onSelect: () => void w.act("DomainEditor", "remove", { domain: id }, { message: `Deleted Domain ${domain.name}` }) }]}
          />
        }
      />
      <div className="editor-body">
        <Problems ids={[id]} />
        <div className="two-columns">
          <Section title="Uses" icon="Language" hint="its own Languages">
            <Chips
              values={domain.languages}
              label={(l) => model.name(l)}
              icon="Language"
              choices={model.languages.map((l) => ({ id: l.id, label: l.name }))}
              onAdd={(language) => void w.act("DomainEditor", "reference", { domain: id, referenced: language })}
              onRemove={(language) => void w.act("DomainEditor", "unreference", { domain: id, referenced: language })}
              onOpen={(language) => w.open({ kind: "language", id: language })}
              addLabel="Language"
              empty="No Language yet."
            />
          </Section>
          <Section title="References" icon="Domain" hint="Domains it builds on, with everything they bring">
            <Chips
              values={domain.references}
              label={(d) => model.name(d)}
              icon="Domain"
              choices={model.domains.filter((d) => d.id !== id).map((d) => ({ id: d.id, label: d.name }))}
              onAdd={(referenced) => void w.act("DomainEditor", "reference", { domain: id, referenced })}
              onRemove={(referenced) => void w.act("DomainEditor", "unreference", { domain: id, referenced })}
              onOpen={(d) => w.open({ kind: "domain", id: d })}
              addLabel="Domain"
              empty="None: it stands alone."
            />
          </Section>
        </div>

        <Section title="In scope" icon="link" hint="the Languages it may use, and what brings each in">
          <div className="scope">
            {[...scope].map(([language, through]) => (
              <button key={language} className="scope-item" onClick={() => w.open({ kind: "language", id: language })}>
                <Icon name="Language" size={14} /> {model.name(language)}
                <span className="muted">{through === id ? "own" : `via ${model.name(through)}`}</span>
              </button>
            ))}
            {scope.size === 0 && <span className="muted">Nothing yet: add a Language it uses, or a Domain it references.</span>}
          </div>
        </Section>

        <Section title="Transformations" icon="Transformation" count={domain.transformations.length} hint="how the things of one Language appear in another">
          {domain.transformations.map((t) => (
            <TransformationRow key={t.id} id={t.id} />
          ))}
          <NewTransformation domain={id} scope={[...scope.keys()]} />
        </Section>

        {roles.length > 0 && (
          <Section title="In Mediations" icon="Mediation">
            <ul className="plain-list">
              {roles.map(({ mediation, role }) => (
                <li key={`${mediation.id}/${role}`}>
                  <button className="link-chip" onClick={() => w.open({ kind: "mediation", id: mediation.id })}>
                    <Icon name="Mediation" size={13} /> {model.name(mediation.id)}
                  </button>{" "}
                  <span className="muted">
                    {role === "what" ? "it is carried out over " + model.name(mediation.how) : role === "how" ? "it carries out " + model.name(mediation.what) : "it is the mediator, the only one knowing both"}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
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
  const source = model.get(t.source);
  const items = source?.kind === "Language" ? source.language.entities.length + source.language.relationships.length + source.language.interactions.length : 0;
  const covered = t.entityMappings.length + t.relationshipMappings.length + t.interactionMappings.length + t.deferred.length;
  const problems = w.diagnostics.filter((d) => d.subjects.some((s) => s === id || s.startsWith(`${id}.`) || s.startsWith(`${id}#`)));
  return (
    <div ref={ref} className="transformation-row row" onClick={() => w.open({ kind: "transformation", id })}>
      <Icon name="Transformation" />
      <span className="cell-main">{t.name}</span>
      <span className="muted">
        {model.name(t.source)} → {model.name(t.target)}
      </span>
      <Badge severity={t.reverse ? "info" : "ok"}>{t.reverse ? "mediation" : "projection"}</Badge>
      <span className="coverage-mini" title={`${covered} of ${items} source items mapped or deferred`}>
        <span style={{ width: `${items ? (100 * Math.min(covered, items)) / items : 100}%` }} />
      </span>
      {problems.length > 0 && <Badge severity={problems.some((p) => p.severity === "error") ? "error" : "warning"}>{problems.length}</Badge>}
      <IconButton icon="chevron" label="Open" onClick={() => w.open({ kind: "transformation", id })} />
    </div>
  );
}

function NewTransformation({ domain, scope }: { domain: string; scope: string[] }) {
  const w = useWorkspace();
  const model = useModel();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>();
  const [target, setTarget] = useState<string>();
  const choices = scope.map((l) => ({ id: l, label: model.name(l) }));
  if (!open)
    return (
      <button className="add-inline" onClick={() => setOpen(true)} disabled={scope.length === 0} title={scope.length === 0 ? "Put Languages in scope first" : undefined}>
        <Icon name="plus" /> Transformation
      </button>
    );
  const create = async () => {
    if (!source || !target) return;
    const name = `${model.name(source)} as ${model.name(target)}`;
    const edit = await w.act("DomainEditor", "addTransformation", { domain, name, source, target }, { quiet: true });
    setOpen(false);
    setSource(undefined);
    setTarget(undefined);
    if (edit) w.open({ kind: "transformation", id: edit.elements[0]! });
  };
  return (
    <div className="new-row">
      From <Picker value={source} choices={choices} placeholder="source Language" onChange={setSource} /> to{" "}
      <Picker value={target} choices={choices} placeholder="target Language" onChange={setTarget} />
      <button className="primary" disabled={!source || !target} onClick={create}>
        Create
      </button>
      <button onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
