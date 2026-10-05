/** The Mediation editor: which "what" is carried out over which "how", by which mediator, and what witnesses it. */
import { useState } from "react";
import { Icon, Menu, Picker } from "../widgets";
import { useModel, useWorkspace } from "../workspace";
import { Description } from "../prose";
import { EditorHeader, Problems } from "./common";

export function MediationEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Mediation") return <p className="empty">This Mediation no longer exists.</p>;
  const m = at.mediation;
  const domains = model.domains.map((d) => ({ id: d.id, label: d.name }));
  const witnesses = model.witnesses(m);
  const set = (role: "What" | "How" | "Mediator", domain?: string) => domain && void w.act("MediationEditor", `set${role}`, { mediation: id, domain });
  const whats = [...model.scope(m.what).keys()];
  const hows = [...model.scope(m.how).keys()];
  const known = (from: string, languages: string[]) => languages.filter((l) => model.scope(from).has(l));
  const whatKnowsHow = known(m.what, witnesses.map((t) => t.target));
  const howKnowsWhat = known(m.how, witnesses.map((t) => t.source));

  return (
    <div className="editor">
      <EditorHeader
        icon="Mediation"
        kind="Mediation"
        id={id}
        name={model.name(id)}
        summary={<>“{model.name(m.what)}” over “{model.name(m.how)}”, as IP over avian carriers</>}
        actions={
          <Menu
            items={[{ label: "Delete Mediation", icon: "trash", danger: true, onSelect: () => void w.act("MediationEditor", "remove", { mediation: id }, { message: "Deleted Mediation" }) }]}
          />
        }
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Mediation: why the what is carried out over this how" />
        <Problems ids={[id]} />
        <div className="sentence">
          <Picker value={m.what} choices={domains} onChange={(d) => set("What", d)} />
          <span>is carried out over</span>
          <Picker value={m.how} choices={domains} onChange={(d) => set("How", d)} />
          <span>by the mediator</span>
          <Picker value={m.mediator} choices={domains} onChange={(d) => set("Mediator", d)} />
        </div>

        <div className={`witness ${witnesses.length ? "ok" : "missing"}`}>
          <Icon name={witnesses.length ? "check" : "error"} size={20} />
          {witnesses.length ? (
            <div>
              <strong>Witnessed</strong> by{" "}
              {witnesses.map((t) => (
                <button key={t.id} className="link-chip" onClick={() => w.open({ kind: "transformation", id: t.id })}>
                  <Icon name="Transformation" size={13} /> {t.name}: {model.name(t.source)} → {model.name(t.target)}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <strong>Not witnessed.</strong> {model.name(m.mediator)} needs a Transformation with a reverse, from a Language of {model.name(m.what)} to a Language of {model.name(m.how)}.
              <Witness mediation={id} whats={whats} hows={hows} />
            </div>
          )}
        </div>

        {(whatKnowsHow.length > 0 || howKnowsWhat.length > 0) && (
          <div className="witness warning-box">
            <Icon name="warning" size={20} />
            <div>
              <strong>Not opaque.</strong>{" "}
              {whatKnowsHow.length > 0 && `${model.name(m.what)} knows ${whatKnowsHow.map((l) => model.name(l)).join(", ")}, which it is carried out in. `}
              {howKnowsWhat.length > 0 && `${model.name(m.how)} knows ${howKnowsWhat.map((l) => model.name(l)).join(", ")}, which it carries. `}
              Only the mediator should know both.
            </div>
          </div>
        )}

        <div className="stack-figure" aria-label="The stack">
          <button onClick={() => w.open({ kind: "domain", id: m.what })} className="layer what">
            <span>what</span>
            {model.name(m.what)}
          </button>
          <button onClick={() => w.open({ kind: "domain", id: m.mediator })} className="layer mediator">
            <span>mediator</span>
            {model.name(m.mediator)}
          </button>
          <button onClick={() => w.open({ kind: "domain", id: m.how })} className="layer how">
            <span>how</span>
            {model.name(m.how)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Makes the witness: the mediator uses both Languages and holds a reversible Transformation between them. */
function Witness({ mediation, whats, hows }: { mediation: string; whats: string[]; hows: string[] }) {
  const w = useWorkspace();
  const model = useModel();
  const m = (model.get(mediation) as { mediation: { what: string; how: string; mediator: string } }).mediation;
  // The natural choice: the Domain's own Language, when it has one; anything in its scope otherwise.
  const own = (domain: string, scope: string[]) => {
    const at = model.get(domain);
    const languages = at?.kind === "Domain" ? at.domain.languages : [];
    return languages.length === 1 ? languages[0] : scope.length === 1 ? scope[0] : undefined;
  };
  const [source, setSource] = useState(own(m.what, whats));
  const [target, setTarget] = useState(own(m.how, hows));
  if (whats.length === 0 || hows.length === 0) return <p className="muted">Both Domains need a Language first.</p>;
  const create = async () => {
    if (!source || !target) return;
    const mediator = model.get(m.mediator);
    if (mediator?.kind !== "Domain") return;
    const scope = model.scope(m.mediator);
    for (const language of [source, target]) {
      if (!scope.has(language)) await w.act("DomainEditor", "reference", { domain: m.mediator, referenced: language }, { quiet: true });
    }
    const edit = await w.act("DomainEditor", "addTransformation", { domain: m.mediator, name: `${model.name(source)} as ${model.name(target)}`, source, target }, { quiet: true });
    if (!edit) return;
    const transformation = edit.elements[0]!;
    await w.act("TransformationEditor", "setReverse", { transformation, reversible: true }, { message: "Created the witness: now map what it represents" });
    w.open({ kind: "transformation", id: transformation });
  };
  return (
    <div className="new-row">
      Create one from <Picker value={source} choices={whats.map((l) => ({ id: l, label: model.name(l) }))} placeholder="a what Language" onChange={setSource} /> to{" "}
      <Picker value={target} choices={hows.map((l) => ({ id: l, label: model.name(l) }))} placeholder="a how Language" onChange={setTarget} />
      <button className="primary" disabled={!source || !target} onClick={create}>
        Create witness
      </button>
    </div>
  );
}
