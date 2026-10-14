/**
 * The Transformation editor: a Transformation is a signature — inputs all of one Language, an
 * output of another. How it maps is the implementation's business, not the design's. It shows
 * where it goes, the Mediations it realizes, and the Transformation that leads back, if one
 * does: a round trip is two Transformations whose signatures lead back.
 */
import { useModel, useWorkspace } from "../workspace";
import { Description } from "../prose";
import { Badge, Icon, InlineText, Menu, Section, type Choice } from "../widgets";
import { EditorHeader, Problems } from "./common";
import { Signature } from "./ComponentEditor";

export function TransformationEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Transformation") return <p className="empty">This Transformation no longer exists.</p>;
  const t = at.transformation;
  const from = model.languageOf(t.parameters[0]?.type);
  const to = model.languageOf(t.output);
  // Inputs and output may be of any Language the holding Component uses.
  const entities: Choice[] = [...new Set(at.component.uses.flatMap((l) => model.vocabEntities(l)))].map((e) => ({ id: e.id, label: e.name, hint: model.languageOf(e.id)?.name }));
  const realizes = model.components.flatMap((c) => c.deployments.flatMap((d) => d.connections.filter((x) => x.mediations.some((m) => m.down === id || m.up === id))));
  // The way back: a Transformation from this one's output Language to its inputs'.
  const back = model.components.flatMap((c) => c.transformations).filter((x) => x.id !== id && from && to && model.languageOf(x.parameters[0]?.type)?.id === to.id && model.languageOf(x.output)?.id === from.id);
  const exported = at.component.exports.some((e) => e.transformation === id);

  return (
    <div className="editor">
      <EditorHeader
        icon="Transformation"
        kind="Transformation"
        id={id}
        name={t.name}
        onRename={(name) => void w.act("FunctionEditor", "rename", { item: id, name })}
        summary={
          <>
            {from ? (
              <button className="link-chip" onClick={() => w.open({ kind: "language", id: from.id })}>
                {from.name}
              </button>
            ) : (
              "?"
            )}{" "}
            →{" "}
            {to ? (
              <button className="link-chip" onClick={() => w.open({ kind: "language", id: to.id })}>
                {to.name}
              </button>
            ) : (
              "?"
            )}{" "}
            held by{" "}
            <button className="link-chip" onClick={() => w.open({ kind: "component", id: at.component.id })}>
              {at.component.name}
            </button>
          </>
        }
        actions={
          <Menu
            items={[
              {
                label: "Delete Transformation",
                icon: "trash",
                danger: true,
                onSelect: () => void w.act("FunctionEditor", "remove", { function: id }, { message: `Deleted Transformation ${t.name}` }),
              },
            ]}
          />
        }
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Transformation: what it says about how one Language is seen in another" />
        <Problems ids={[id, ...t.parameters.map((p) => p.id)]} />
        <Section title="Signature" icon="Transformation" hint="inputs all of one Language, an output of another; how it maps is the implementation's">
          <div className="signature">
            <Icon name="Transformation" />
            <InlineText className="interaction-name" value={t.name} onCommit={(name) => void w.act("FunctionEditor", "rename", { item: id, name })} />
            <Signature f={t} entities={entities} />
            {exported ? <Badge severity="info">exported</Badge> : <span className="muted">internal</span>}
          </div>
        </Section>
        <div className="two-columns">
          <Section title="Leads back" icon="Transformation" hint="a Transformation from its output's Language to its inputs': together, a round trip">
            {back.length === 0 ? (
              <span className="muted">None: one way.</span>
            ) : (
              <ul className="card-list">
                {back.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => w.open({ kind: "transformation", id: x.id })}>
                      <Icon name="Transformation" size={14} />
                      <span className="card-title">{x.name}</span>
                      <span className="muted">{model.signature(x)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Realizes" icon="Connection" count={realizes.length} hint="the Mediations it is the way down or up of">
            {realizes.length === 0 ? (
              <span className="muted">No Mediation yet.</span>
            ) : (
              <ul className="card-list">
                {realizes.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => w.reveal(x.id)}>
                      <Icon name="Connection" size={14} />
                      <span className="card-title">{model.name(x.id)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
