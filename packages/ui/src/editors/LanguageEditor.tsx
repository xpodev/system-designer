/**
 * The Language editor: a Language's Entities, Relationships, Interactions and Axioms, each
 * edited in place, with the Language as a diagram above them when wanted. It speaks to the
 * LanguageEditor, EntityEditor, RelationshipEditor, FormulaEditor, InteractionEditor and
 * StdEditor of the host.
 */
import { useEffect, useState } from "react";
import { api, type View } from "../api";
import { Graph } from "../Graph";
import { counted, rangeOf, UNNAMED, type EndJson, type InteractionJson, type LanguageJson, type RelationshipJson } from "../model";
import { Description } from "../prose";
import { AddInline, Badge, Icon, IconButton, InlineText, Marks, Menu, Picker, RangePicker, Section, type Choice } from "../widgets";
import { useFocusRow, useModel, useWorkspace } from "../workspace";
import { EditorHeader, Problems } from "./common";

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function LanguageEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Language") return <p className="empty">This Language no longer exists.</p>;
  const language = at.language;
  const mode = w.layout.languageMode?.[id] ?? "lists";
  const setMode = (m: "lists" | "diagram") => w.setLayout((l) => ({ ...l, languageMode: { ...l.languageMode, [id]: m } }));
  const usedBy = model.domains.filter((d) => d.languages.includes(id));
  const entities: Choice[] = language.entities.map((e) => ({ id: e.id, label: e.name }));

  const addEntity = async (name: string) => {
    const edit = await w.act("LanguageEditor", "addEntity", { language: id, name }, { quiet: true });
    if (edit) w.reveal(edit.elements[0]!);
  };

  return (
    <div className="editor">
      <EditorHeader
        icon="Language"
        kind="Language"
        id={id}
        name={language.name}
        onRename={(name) => void w.act("LanguageEditor", "rename", { language: id, name })}
        summary={
          <>
            {language.entities.length} entities · {language.relationships.length} relationships · {language.interactions.length} interactions · {language.formulas.length} axioms
          </>
        }
        actions={
          <>
            <div className="segmented" role="group" aria-label="Show">
              <button className={mode === "lists" ? "on" : ""} onClick={() => setMode("lists")} title="Lists">
                <Icon name="table" /> Lists
              </button>
              <button className={mode === "diagram" ? "on" : ""} onClick={() => setMode("diagram")} title="Diagram and lists">
                <Icon name="diagram" /> Diagram
              </button>
            </div>
            <Menu
              items={[
                {
                  label: "Delete Language",
                  icon: "trash",
                  danger: true,
                  onSelect: () => void w.act("LanguageEditor", "remove", { language: id }, { message: `Deleted Language ${language.name}, and everything that went with it` }),
                },
              ]}
            />
          </>
        }
      />
      <div className="editor-body">
        <p className="used-by">
          {usedBy.length === 0 ? (
            <span className="muted">No Domain uses this Language yet. A Language needs no Domain to be valid; a Domain is where it is used.</span>
          ) : (
            <>
              Used by{" "}
              {usedBy.map((d) => (
                <button key={d.id} className="link-chip" onClick={() => w.open({ kind: "domain", id: d.id })}>
                  <Icon name="Domain" size={13} /> {d.name}
                </button>
              ))}
            </>
          )}
        </p>
        <Description id={id} className="about" invite="Describe this Language: what it is the vocabulary of, and what it is for" />
        <Problems ids={[id]} />

        {mode === "diagram" && <LanguageDiagram language={language} onAddEntity={addEntity} />}

        <Section title="Entities" icon="Entity" count={language.entities.length} hint="the kinds of thing this Language knows">
          <table className="grid">
            <tbody>
              {language.entities.map((e) => (
                <EntityRow key={e.id} id={e.id} language={language} />
              ))}
            </tbody>
          </table>
          <AddInline label="Entity" placeholder="Name, then Enter — e.g. Order" onAdd={addEntity} />
        </Section>

        <Section title="Relationships" icon="Relationship" count={language.relationships.length} hint="each line reads one way: what each of an Entity has of the other, and the name it reaches them by">
          {language.relationships.map((r) => (
            <RelationshipRow key={r.id} relationship={r} entities={entities} />
          ))}
          {language.entities.length === 0 ? (
            <p className="muted">Add an Entity first: a Relationship joins two of them.</p>
          ) : (
            <button className="add-inline" onClick={() => void addRelationship(w, language, language.entities[0]!.id, (language.entities[1] ?? language.entities[0]!).id)}>
              <Icon name="plus" /> Relationship
            </button>
          )}
        </Section>

        <Section title="Interactions" icon="Interaction" count={language.interactions.length} hint="the operations this Language offers: Parameters in, an output out">
          {language.interactions.map((i) => (
            <InteractionCard key={i.id} interaction={i} entities={entities} />
          ))}
          {language.entities.length === 0 ? (
            <p className="muted">Add an Entity first: an Interaction's output is one.</p>
          ) : (
            <AddInline
              label="Interaction"
              placeholder="Name, then Enter — e.g. cancel"
              onAdd={async (name) => {
                const edit = await w.act("InteractionEditor", "addInteraction", { language: id, name, output: language.entities[0]!.id }, { quiet: true });
                if (edit) w.reveal(edit.elements[0]!);
              }}
            />
          )}
        </Section>

        <Section title="Axioms" icon="Formula" count={language.formulas.length} hint="what is always true, over this Language only">
          {language.formulas.map((f) => (
            <AxiomRow key={f.id} id={f.id} language={language} />
          ))}
          <AddInline
            label="Axiom"
            mono
            placeholder="all o in Order, l in o.lines. l.order == o"
            onAdd={(text) => void w.act("LanguageEditor", "addFormula", { language: id, text })}
          />
          <p className="syntax-help">
            <code>all x in E. …</code> <code>some x in E. …</code> <code>x.end</code> <code>x.^end</code> (one or more steps) <code>x.*end</code> <code>==</code> <code>!=</code>{" "}
            <code>in</code> <code>and</code> <code>or</code> <code>not</code> <code>=&gt;</code> <code>some x.end</code> <code>no x.end</code>
          </p>
        </Section>
      </div>
    </div>
  );
}

function EntityRow({ id, language }: { id: string; language: LanguageJson }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(id);
  const entity = language.entities.find((e) => e.id === id)!;
  const comparison = language.interactions.find((i) => i.compares.includes(id));
  const uses = model.usesOf(id);
  return (
    <tr ref={ref} className="row">
      <td className="cell-icon">
        <Icon name="Entity" />
      </td>
      <td>
        <div className="cell-main">
          <InlineText value={entity.name} onCommit={(name) => void w.act("EntityEditor", "rename", { entity: id, name })} />
          <Marks diagnostics={w.about(id)} />
        </div>
        <Description id={id} className="row-description" />
      </td>
      <td className="cell-muted">{uses === 0 ? "unused" : `${uses} use${uses === 1 ? "" : "s"}`}</td>
      <td className="cell-muted">
        {comparison ? (
          <span title="Std: this Language's own notion of sameness for it">compared by {comparison.name}</span>
        ) : null}
      </td>
      <td className="cell-actions">
        <Menu
          items={[
            ...language.interactions
              .filter((i) => i.id !== comparison?.id)
              .map((i) => ({ label: `Compare by ${i.name}`, icon: "Interaction", onSelect: () => void w.act("StdEditor", "setComparison", { entity: id, interaction: i.id }) })),
            ...(comparison ? [{ label: "No comparison", icon: "x", onSelect: () => void w.act("StdEditor", "setComparison", { entity: id }) }] : []),
            { label: "Delete Entity", icon: "trash", danger: true, onSelect: () => void w.act("EntityEditor", "remove", { entity: id }, { message: `Deleted Entity ${entity.name}` }) },
          ]}
        />
      </td>
    </tr>
  );
}

/**
 * A Relationship, read one line per way through it: `Each Player has any number of Monsters,
 * as .prey`. A line is the Entity at one end, then the far end's range — how many of the far
 * end's Entity each has — and the far end's name, which is how it navigates to them. Clearing
 * a name leaves that end unnamed: the Relationship can then not be navigated that way.
 */
function RelationshipRow({ relationship, entities }: { relationship: RelationshipJson; entities: Choice[] }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(relationship.id);
  const [a, b] = relationship.ends;
  const problems = w.about(relationship.id);
  /** The way from `at`'s Entity to `far`'s. */
  const way = (at: EndJson | undefined, far: EndJson | undefined) => {
    if (!at || !far) return null;
    const from = model.name(at.entity);
    const to = model.name(far.entity);
    return (
      <div className="way">
        <span className="way-word">Each</span>
        <Picker value={at.entity} choices={entities} invalid={w.about(at.id).length > 0} onChange={(entity) => entity && void w.act("RelationshipEditor", "setEntity", { end: at.id, entity })} />
        <span className="way-word">has</span>
        <RangePicker words value={rangeOf(far)} invalid={w.about(far.id).length > 0} onChange={(range) => void w.act("RelationshipEditor", "setRange", { end: far.id, range })} />
        <span className="way-target">{counted(to, far.max)}</span>
        <span className="way-word">as</span>
        <span
          className={`navigation ${far.name === null ? "unnamed" : ""}`}
          title={far.name === null ? `No ${from} reaches its ${to} this way: name it to make it navigable` : `From a ${from}, .${far.name} reaches its ${counted(to, far.max)}`}
        >
          <span className="dot-step">.</span>
          <InlineText
            value={far.name ?? ""}
            placeholder={UNNAMED}
            clearable
            className={w.about(far.id).length > 0 ? "invalid-value" : ""}
            onCommit={(name) => void w.act("RelationshipEditor", "renameEnd", name === "" ? { end: far.id } : { end: far.id, name }, { message: name === "" ? `${from} no longer reaches ${to} this way` : undefined })}
          />
        </span>
      </div>
    );
  };
  return (
    <div ref={ref} className={`relationship row ${problems.length ? "has-problems" : ""}`}>
      <div className="ways">
        {way(a, b)}
        {way(b, a)}
      </div>
      <span className="row-tail">
        <Marks diagnostics={[...problems, ...relationship.ends.flatMap((e) => w.about(e.id))]} />
        <IconButton icon="trash" label="Delete Relationship" onClick={() => void w.act("RelationshipEditor", "remove", { relationship: relationship.id }, { message: "Deleted Relationship" })} />
      </span>
      <Description id={relationship.id} className="row-description" />
    </div>
  );
}

function InteractionCard({ interaction, entities }: { interaction: InteractionJson; entities: Choice[] }) {
  const w = useWorkspace();
  const ref = useFocusRow(interaction.id);
  const i = interaction;
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
        <button
          className="add-parameter"
          title="Add a Parameter"
          onClick={() => {
            const type = entities[0]!;
            const taken = new Set(i.parameters.map((p) => p.name));
            let name = lowerFirst(type.label);
            for (let n = 2; taken.has(name); n++) name = `${lowerFirst(type.label)}${n}`;
            void w.act("InteractionEditor", "addParameter", { interaction: i.id, name, type: type.id }, { quiet: true });
          }}
        >
          <Icon name="plus" size={12} />
        </button>
        <span className="paren">)</span>
        <span className="arrow">→</span>
        <Picker value={i.output} choices={entities} onChange={(output) => output && void w.act("InteractionEditor", "setOutput", { interaction: i.id, output })} />
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

function AxiomRow({ id, language }: { id: string; language: LanguageJson }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(id);
  const formula = language.formulas.find((f) => f.id === id)!;
  const problems = w.about(id);
  return (
    <div ref={ref} className={`axiom row ${problems.length ? "has-problems" : ""}`}>
      <Icon name="Formula" />
      <div className="axiom-main">
        <InlineText mono multiline value={formula.text} onCommit={(text) => void w.act("FormulaEditor", "setText", { formula: id, text })} />
        {problems.map((p, n) => (
          <p key={n} className={`inline-problem ${p.severity}`}>
            {p.message}
          </p>
        ))}
        <Description id={id} className="row-description" />
      </div>
      <label className="constrains" title="The Relationship this axiom is about, if one">
        on
        <Picker
          value={formula.constrains}
          allowNone
          placeholder="the whole Language"
          choices={language.relationships.map((r) => ({ id: r.id, label: model.name(r.id) }))}
          onChange={(relationship) => void w.act("FormulaEditor", "constrain", relationship ? { formula: id, relationship } : { formula: id })}
        />
      </label>
      <IconButton icon="trash" label="Delete Axiom" onClick={() => void w.act("FormulaEditor", "remove", { formula: id }, { message: "Deleted Axiom" })} />
    </div>
  );
}

function LanguageDiagram({ language, onAddEntity }: { language: LanguageJson; onAddEntity(name: string): void }) {
  const w = useWorkspace();
  const [view, setView] = useState<View>();
  useEffect(() => {
    void api.view(w.context, "language", language.id).then(setView, () => setView(undefined));
  }, [w.context, language.id, w.version]);
  const key = `language/${language.id}`;
  if (!view) return null;
  return (
    <div className="diagram-panel">
      <div className="diagram-hint">Drag an Entity's handle onto another to relate them · double-click empty space to add an Entity · drag boxes to arrange</div>
      <Graph
        view={view}
        height={300}
        saved={w.layout.positions?.[key] ?? {}}
        onSelect={(subject) => w.reveal(subject)}
        onMove={(positions) => w.setLayout((l) => ({ ...l, positions: { ...l.positions, [key]: positions } }))}
        onConnect={(a, b) => void addRelationship(w, language, a, b)}
        onCreate={() => {
          const taken = new Set(language.entities.map((e) => e.name));
          let name = "NewEntity";
          for (let n = 2; taken.has(name); n++) name = `NewEntity${n}`;
          onAddEntity(name);
        }}
      />
    </div>
  );
}

/**
 * A new Relationship between two Entities, with ends named after them — `order` (1..1) at
 * Order and `orderLines` (0..N) at OrderLine — or `parent` and `children` when an Entity
 * relates to itself. A name already reachable from the other side gets a number.
 */
async function addRelationship(w: ReturnType<typeof useWorkspace>, language: LanguageJson, a: string, b: string) {
  const name = (id: string) => language.entities.find((e) => e.id === id)?.name ?? "item";
  const reachable = (entity: string) =>
    new Set(language.relationships.flatMap((r) => r.ends.flatMap((end, i) => (end.entity === entity ? [r.ends[1 - i]!.name] : []))));
  const free = (wanted: string, from: string) => {
    const taken = reachable(from);
    let n = wanted;
    for (let k = 2; taken.has(n); k++) n = `${wanted}${k}`;
    return n;
  };
  const self = a === b;
  const aName = free(self ? "parent" : lowerFirst(name(a)), b);
  const bName = free(self ? "children" : `${lowerFirst(name(b))}s`, a);
  const edit = await w.act(
    "LanguageEditor",
    "addRelationship",
    { language: language.id, aEntity: a, aName, aRange: self ? "0..1" : "1..1", bEntity: b, bName, bRange: "0..N" },
    { message: `Related ${name(a)} and ${name(b)}: adjust the ends below` },
  );
  if (edit) w.reveal(edit.elements[0]!);
}
