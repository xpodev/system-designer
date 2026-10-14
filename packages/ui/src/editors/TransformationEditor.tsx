/**
 * The Transformation editor: every item of the source Language beside what it is represented
 * with in the target — mapped, deliberately deferred, or missing — and what must be kept for
 * it to work: its context, from the target's vocabulary. One way only; going back is another
 * Transformation.
 */
import { relationshipLabel, type LanguageJson, type TransformationJson } from "../model";
import { Badge, Chips, Icon, IconButton, Menu, Section, type Choice } from "../widgets";
import { useFocusRow, useModel, useWorkspace } from "../workspace";
import { Description } from "../prose";
import { EditorHeader, Problems } from "./common";

type ItemKind = "entity" | "relationship";

const KINDS: { kind: ItemKind; title: string; icon: string; operation: string }[] = [
  { kind: "entity", title: "Entities", icon: "Entity", operation: "mapEntity" },
  { kind: "relationship", title: "Relationships", icon: "Relationship", operation: "mapRelationship" },
];

export function TransformationEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Transformation") return <p className="empty">This Transformation no longer exists.</p>;
  const t = at.transformation;
  const sourceLanguage = model.language(t.source);
  const targetVocabulary = model.vocab(t.target);
  const name = (x: string) => model.name(x);
  const items = sourceLanguage ? KINDS.flatMap((k) => itemsOf([sourceLanguage], k.kind, name)) : [];
  const status = (item: string) => (isDeferred(t, item) ? "deferred" : mappingOf(t, item) ? "mapped" : "missing");
  const counts = { mapped: items.filter((i) => status(i.id) === "mapped").length, deferred: items.filter((i) => status(i.id) === "deferred").length };
  const missing = items.length - counts.mapped - counts.deferred;
  const ownProblems = w.diagnostics.filter((d) => d.subjects.some((s) => s.startsWith(`${id}#`)));
  const realizes = model.components.flatMap((c) => c.deployments.flatMap((d) => d.connections.filter((x) => x.mediations.some((m) => m.down === id || m.up === id))));

  return (
    <div className="editor">
      <EditorHeader
        icon="Transformation"
        kind="Transformation"
        id={id}
        name={t.name}
        onRename={(name) => void w.act("TransformationEditor", "rename", { transformation: id, name })}
        summary={
          <>
            <button className="link-chip" onClick={() => w.open({ kind: "language", id: t.source })}>
              {model.name(t.source)}
            </button>{" "}
            →{" "}
            <button className="link-chip" onClick={() => w.open({ kind: "language", id: t.target })}>
              {model.name(t.target)}
            </button>{" "}
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
                onSelect: () => void w.act("TransformationEditor", "remove", { transformation: id }, { message: `Deleted Transformation ${t.name}` }),
              },
            ]}
          />
        }
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Transformation: what it says about how one Language is seen in another" />
        <Problems ids={[id]} />
        {ownProblems.length > 0 && (
          <p className="inline-problem error">
            {ownProblems.length} mapping problem{ownProblems.length === 1 ? "" : "s"}: {ownProblems.map((p) => p.message).filter((m, i, all) => all.indexOf(m) === i).join("; ")}.
          </p>
        )}

        <div className="kind-card">
          <div className="context-row">
            <span className="label">Context</span>
            <Chips
              values={t.context}
              label={(e) => model.name(e)}
              icon="Entity"
              choices={targetVocabulary.flatMap((l) => l.entities.map((e) => ({ id: e.id, label: e.name, hint: l.name })))}
              onAdd={(entity) => void w.act("TransformationEditor", "setContext", { transformation: id, context: [...t.context, entity] })}
              onRemove={(entity) => void w.act("TransformationEditor", "setContext", { transformation: id, context: t.context.filter((e) => e !== entity) })}
              addLabel="context Entity"
              empty="by value: nothing need be kept for it to work"
            />
          </div>
          {realizes.length > 0 && (
            <p className="muted">
              Realizes {realizes.length} Mediation{realizes.length === 1 ? "" : "s"}:{" "}
              {realizes.map((c) => (
                <button key={c.id} className="link-chip" onClick={() => w.reveal(c.id)}>
                  <Icon name="Connection" size={13} /> {model.name(c.id)}
                </button>
              ))}
            </p>
          )}
        </div>

        <div className="coverage">
          <div className="coverage-bar" role="img" aria-label={`${counts.mapped} mapped, ${counts.deferred} deferred, ${missing} missing`}>
            <span className="mapped" style={{ flex: counts.mapped }} />
            <span className="deferred" style={{ flex: counts.deferred }} />
            <span className="missing" style={{ flex: missing }} />
          </div>
          <span>
            <b>{counts.mapped}</b> mapped · <b>{counts.deferred}</b> deferred · <b className={missing ? "missing-text" : ""}>{missing}</b> missing, of {items.length} items of {model.name(t.source)}
          </span>
        </div>

        {sourceLanguage && targetVocabulary.length > 0 ? (
          KINDS.map((k) => {
            const sourceItems = itemsOf([sourceLanguage], k.kind, name);
            if (sourceItems.length === 0) return null;
            const choices = itemsOf(targetVocabulary, k.kind, name);
            return (
              <Section key={k.kind} title={k.title} icon={k.icon} count={sourceItems.length}>
                <div className="mapping-head">
                  <span>{model.name(t.source)}</span>
                  <span />
                  <span>is represented in {model.name(t.target)} with</span>
                </div>
                {sourceItems.map((item) => (
                  <MappingRow key={item.id} t={t} item={item} kind={k} choices={choices} sourceLanguage={sourceLanguage} />
                ))}
              </Section>
            );
          })
        ) : (
          <p className="muted">The source or target Language is missing.</p>
        )}
      </div>
    </div>
  );
}

function MappingRow(props: { t: TransformationJson; item: Choice; kind: (typeof KINDS)[number]; choices: Choice[]; sourceLanguage: LanguageJson }) {
  const { t, item, kind, choices, sourceLanguage } = props;
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(item.id);
  const mapping = mappingOf(t, item.id);
  const deferred = isDeferred(t, item.id);
  const needs = mapping ? prerequisites(sourceLanguage, item.id).filter((e) => !mappingOf(t, e)) : [];
  const set = (targets: string[]) =>
    targets.length === 0
      ? void w.act("TransformationEditor", "unmap", { transformation: t.id, source: item.id })
      : void w.act("TransformationEditor", kind.operation, { transformation: t.id, source: item.id, targets });
  return (
    <div ref={ref} className={`mapping-row row ${deferred ? "is-deferred" : mapping ? "is-mapped" : "is-missing"}`}>
      <span className="mapping-source">
        <Icon name={kind.icon} size={14} /> {item.label}
      </span>
      <span className="mapping-arrow">↦</span>
      <div className="mapping-targets">
        {deferred ? (
          <span className="muted">deliberately left unmapped</span>
        ) : (
          <Chips
            values={mapping?.targets ?? []}
            label={(id) => model.name(id)}
            choices={choices}
            onAdd={(target) => set([...(mapping?.targets ?? []), target])}
            onRemove={(target) => set((mapping?.targets ?? []).filter((x) => x !== target))}
            addLabel={mapping ? "more" : "map to…"}
          />
        )}
        {needs.length > 0 && <span className="inline-problem error">needs {needs.map((e) => model.name(e)).join(", ")} mapped first</span>}
      </div>
      <span className="row-tail">
        {deferred ? <Badge severity="info">deferred</Badge> : mapping ? null : <Badge severity="warning">missing</Badge>}
        <IconButton
          icon={deferred ? "undo" : "x"}
          label={deferred ? "Map it after all" : "Defer: leave it unmapped on purpose"}
          onClick={() => void w.act("StdEditor", deferred ? "undefer" : "defer", { transformation: t.id, item: item.id })}
          disabled={!!mapping && !deferred}
        />
      </span>
    </div>
  );
}

function itemsOf(languages: LanguageJson[], kind: ItemKind, name: (id: string) => string): Choice[] {
  if (kind === "entity") return languages.flatMap((l) => l.entities.map((e) => ({ id: e.id, label: e.name })));
  return languages.flatMap((l) => l.relationships.map((r) => ({ id: r.id, label: relationshipLabel(r, name) })));
}

function mappingOf(t: TransformationJson, source: string) {
  return [...t.entityMappings, ...t.relationshipMappings].find((m) => m.source === source);
}

function isDeferred(t: TransformationJson, item: string): boolean {
  return t.deferred.some((d) => d.entity === item || d.relationship === item);
}

/** Definition before use (W7): what must be mapped for this item's mapping to mean anything. */
function prerequisites(language: LanguageJson, item: string): string[] {
  const relationship = language.relationships.find((r) => r.id === item);
  return relationship ? relationship.ends.map((end) => end.entity) : [];
}
