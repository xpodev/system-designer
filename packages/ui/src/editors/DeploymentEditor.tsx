/**
 * The Deployment editor: one way to build a box — its internal layout. Its Instances on a
 * canvas, connected by drawing from one to what it uses — another Instance, an identity the
 * Deployment imports, or the box itself — and, for each Connection, its What and the stack of
 * Mediums it is passed over, each realized or not, broken when its Medium is gone. Connections
 * are structure, through interfaces: only a call out through the box needs an import, asked
 * first. Its needs, the identities it imports, what each Instance runs if fixed, and which of
 * its placements it exposes, are edited here too.
 */
import { useEffect, useState } from "react";
import { api, type View } from "../api";
import { Graph } from "../Graph";
import type { ComponentJson, ConnectionJson, DeploymentJson } from "../model";
import { Description } from "../prose";
import { AddInline, Badge, Chips, Icon, IconButton, InlineText, Marks, Menu, Picker, Section } from "../widgets";
import { useFocusRow, useModel, useWorkspace } from "../workspace";
import { EditorHeader, Problems } from "./common";
import { Imports } from "./ComponentEditor";

/** A Connection being made: from an Instance, to an Instance or the deployed Component. */
interface Draft {
  from: string;
  to: string;
}

export function DeploymentEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const [draft, setDraft] = useState<Draft>();
  const at = model.get(id);
  if (at?.kind !== "Deployment") return <p className="empty">This Deployment no longer exists.</p>;
  const deployment = at.deployment;
  // The box it lays out, and the Component it is kept in: the box itself, or another.
  const deployed = at.box ?? at.component;
  const keeper = at.component;
  // What may be placed: what its box's and keeper's scope hold, and top-level Components it imports.
  const placeable = model.placeableIn(id);

  return (
    <div className="editor">
      <EditorHeader
        icon="Deployment"
        kind="Deployment"
        id={id}
        name={deployment.name}
        onRename={(name) => void w.act("DeploymentEditor", "rename", { item: id, name })}
        summary={
          <>
            of{" "}
            <button className="link-chip" onClick={() => w.open({ kind: "component", id: deployed.id })}>
              {deployed.name}
            </button>
            {keeper.id !== deployed.id && (
              <>
                {" "}
                · kept in{" "}
                <button className="link-chip" onClick={() => w.open({ kind: "component", id: keeper.id })}>
                  {keeper.name}
                </button>
              </>
            )}{" "}
            · {deployment.instances.length} instance{deployment.instances.length === 1 ? "" : "s"} · {deployment.connections.length} connection{deployment.connections.length === 1 ? "" : "s"}
          </>
        }
        actions={<Menu items={[{ label: "Delete Deployment", icon: "trash", danger: true, onSelect: () => void w.act("DeploymentEditor", "remove", { item: id }, { message: `Deleted Deployment ${deployment.name}` }) }]} />}
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Deployment: when it is the way to build the box" />
        <Problems ids={[id]} />
        <DeploymentCanvas deployment={deployment} onConnect={(from, to) => setDraft({ from, to })} />
        {draft && <ConnectPanel deployment={deployment} deployed={deployed} draft={draft} close={() => setDraft(undefined)} />}

        <Section title="Instances" icon="Instance" count={deployment.instances.length} hint="placements: what a real Instance running it will contain">
          {deployment.instances.map((i) => (
            <InstanceRow key={i.id} id={i.id} deployment={deployment} deployed={deployed} onConnect={(to) => setDraft({ from: i.id, to })} />
          ))}
          <NewInstance deployment={deployment} placeable={placeable} />
        </Section>

        <Section title="Connections" icon="Connection" count={deployment.connections.length} hint="each from what uses its What to what offers it, passed over the Mediums chosen for it">
          {deployment.connections.map((c) => (
            <ConnectionCard key={c.id} connection={c} deployment={deployment} deployed={deployed} />
          ))}
          {deployment.connections.length === 0 && <p className="muted">Draw from an Instance's handle onto what it uses, or use the menu of an Instance.</p>}
        </Section>

        <div className="two-columns">
          <Imports owner={id} imports={deployment.imports} needs />
          <Identities deployment={deployment} />
        </div>
      </div>
    </div>
  );
}

function DeploymentCanvas({ deployment, onConnect }: { deployment: DeploymentJson; onConnect(from: string, to: string): void }) {
  const w = useWorkspace();
  const [view, setView] = useState<View>();
  useEffect(() => {
    void api.view(w.context, "deployment", deployment.id).then(setView, () => setView(undefined));
  }, [w.context, deployment.id, w.version]);
  const key = `deployment/${deployment.id}`;
  if (!view) return null;
  return (
    <div className="diagram-panel">
      <div className="diagram-hint">Drag an Instance's handle onto what it uses — another Instance, or the Component itself — to connect them · drag boxes to arrange</div>
      <Graph
        view={view}
        height={240}
        saved={w.layout.positions?.[key] ?? {}}
        onSelect={(subject) => w.reveal(subject)}
        onMove={(positions) => w.setLayout((l) => ({ ...l, positions: { ...l.positions, [key]: positions } }))}
        connectable={(item) => item.kind === "Instance"}
        handleHint="Drag onto what this Instance uses, to connect them"
        onConnect={(from, to) => from !== to && onConnect(from, to)}
      />
    </div>
  );
}

/**
 * What a Connection to `to` can carry: the Interactions offered there — an Instance's box's own
 * and those of the APIs it exports; an identity's box's; or the Deployment's box's, and what the
 * Deployment imports, to call out through it.
 */
function offeredAt(model: ReturnType<typeof useModel>, deployment: DeploymentJson, deployed: ComponentJson, to: string): string[] {
  const own = (c: ComponentJson) => [
    ...c.interactions.map((i) => i.id),
    ...c.exports.flatMap((e) => (e.component === undefined ? [] : (model.component(e.component)?.interactions ?? []).map((i) => i.id))),
  ];
  const at = model.get(to);
  if (at?.kind === "Instance") {
    const of = model.component(at.instance.of);
    return of ? [...new Set(own(of))] : [];
  }
  if (at?.kind === "Import") {
    const last = model.get(at.import.path?.at(-1) ?? "");
    const of = last?.kind === "Instance" ? model.component(last.instance.of) : undefined;
    return of ? [...new Set(own(of))] : [];
  }
  if (to === deployed.id) {
    // Out through the box: what it offers, what the Deployment imports, then what it could import.
    const lineage = new Set(model.ancestry(deployed.id).map((c) => c.id));
    const elsewhere = model.components.filter((c) => !lineage.has(c.id)).flatMap((c) => c.interactions.map((i) => i.id));
    return [...new Set([...own(deployed), ...model.imported(deployment.id, "Interaction"), ...elsewhere])];
  }
  return [];
}

/**
 * Making a Connection: which of the Interactions offered there it carries, all over one
 * Language. A Connection is structure, through interfaces, and needs nothing of the caller; only
 * one out through the box needs the Deployment to import what the box does not offer — asked,
 * since the Connection may be a mistake.
 */
function ConnectPanel({ deployment, deployed, draft, close }: { deployment: DeploymentJson; deployed: ComponentJson; draft: Draft; close(): void }) {
  const w = useWorkspace();
  const model = useModel();
  const offered = offeredAt(model, deployment, deployed, draft.to);
  const [what, setWhat] = useState<string[]>(offered.slice(0, 1));
  const [addImports, setAddImports] = useState(true);
  if (model.get(draft.from)?.kind !== "Instance") return null;
  const language = model.interaction(what[0])?.language;
  const boxOffers = new Set([
    ...deployed.interactions.map((i) => i.id),
    ...deployed.exports.flatMap((e) => (e.component === undefined ? [] : (model.component(e.component)?.interactions ?? []).map((i) => i.id))),
    ...model.imported(deployment.id, "Interaction"),
  ]);
  const imports = draft.to === deployed.id ? what.filter((i) => !boxOffers.has(i)) : [];
  const mixed = what.some((i) => model.interaction(i)?.language !== language);
  const connect = async () => {
    const edit = await w.act(
      "DeploymentEditor",
      "connect",
      { deployment: deployment.id, from: draft.from, to: draft.to, what, addImports: addImports && imports.length > 0 },
      { message: `Connected ${model.name(draft.from)} to ${model.name(draft.to)}` },
    );
    if (edit) close();
  };
  return (
    <div className="connect-panel">
      <header>
        <Icon name="Connection" /> <strong>{model.name(draft.from)}</strong> uses <strong>{model.name(draft.to)}</strong>
        <IconButton icon="x" label="Cancel" onClick={close} />
      </header>
      {offered.length === 0 ? (
        <p className="muted">{model.name(draft.to)} offers no Interaction: give its Component one first.</p>
      ) : (
        <>
          <div className="what-choices">
            <span className="label">What</span>
            {offered.map((i) => (
              <label key={i} className="check">
                <input type="checkbox" checked={what.includes(i)} onChange={(e) => setWhat(e.target.checked ? [...what, i] : what.filter((x) => x !== i))} />
                {model.name(i)}() <span className="muted">over {model.name(model.interaction(i)?.language)}</span>
              </label>
            ))}
          </div>
          {mixed && <p className="inline-problem error">A Connection's What is over one Language: choose Interactions over one.</p>}
          {imports.length > 0 && (
            <label className="check confirm">
              <input type="checkbox" checked={addImports} onChange={(e) => setAddImports(e.target.checked)} />
              {deployment.name} does not import {imports.map((i) => model.name(i)).join(", ")}: make it import {imports.length === 1 ? "it" : "them"}, as its need
            </label>
          )}
          <div className="row-buttons start">
            <button className="primary" disabled={what.length === 0 || mixed} onClick={() => void connect()}>
              Connect
            </button>
            <button onClick={close}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

function InstanceRow({ id, deployment, deployed, onConnect }: { id: string; deployment: DeploymentJson; deployed: ComponentJson; onConnect(to: string): void }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(id);
  const instance = deployment.instances.find((i) => i.id === id)!;
  const identities = deployment.imports.filter((i) => i.path !== undefined);
  const targets = [
    ...deployment.instances.filter((i) => i.id !== id),
    ...identities.map((i) => ({ id: i.id, name: model.name(i.id) })),
    { id: deployed.id, name: `${deployed.name} itself` },
  ];
  const exposure = deployment.exposes.find((e) => e.instance === id);
  const options = model.deploymentsOf(instance.of);
  return (
    <div ref={ref} className="instance-row row">
      <Icon name="Instance" />
      <InlineText className="cell-main" value={instance.name} onCommit={(name) => void w.act("DeploymentEditor", "rename", { item: id, name })} />
      <span className="muted">of</span>
      <button className="link-chip" onClick={() => w.open({ kind: "component", id: instance.of })}>
        <Icon name="Component" size={13} /> {model.name(instance.of)}
      </button>
      {options.length > 0 && (
        <>
          <span className="muted">runs</span>
          <Picker
            value={instance.runs ?? undefined}
            allowNone
            placeholder="the Configuration's choice"
            choices={options.map((d) => ({ id: d.id, label: d.name }))}
            onChange={(runs) => void w.act("DeploymentEditor", "setRuns", { instance: id, ...(runs ? { deployment: runs } : {}) })}
          />
        </>
      )}
      {exposure && <Badge severity="info">exposed</Badge>}
      <span className="row-tail">
        <Marks diagnostics={w.about(id)} />
        <Menu
          items={[
            ...targets.map((t) => ({ label: `Connect to ${t.name}`, icon: "Connection", onSelect: () => onConnect(t.id) })),
            exposure
              ? { label: "Stop exposing it", icon: "x", onSelect: () => void w.act("DeploymentEditor", "remove", { item: exposure.id }) }
              : { label: "Expose it: identities may go through it", icon: "link", onSelect: () => void w.act("DeploymentEditor", "expose", { deployment: deployment.id, instance: id }) },
            { label: "Delete Instance", icon: "trash", danger: true, onSelect: () => void w.act("DeploymentEditor", "remove", { item: id }, { message: `Deleted Instance ${instance.name}` }) },
          ]}
        />
      </span>
      <Description id={id} className="row-description" />
    </div>
  );
}

function NewInstance({ deployment, placeable }: { deployment: DeploymentJson; placeable: ComponentJson[] }) {
  const w = useWorkspace();
  const model = useModel();
  const [of, setOf] = useState<string>();
  if (placeable.length === 0) return <p className="muted">Nothing to place: give the box a child, or import a top-level Component.</p>;
  const taken = new Set(deployment.instances.map((i) => i.name));
  const suggested = (component: string) => {
    const base = model.name(component).replace(/^\w/, (c) => c.toLowerCase());
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
    return name;
  };
  return (
    <div className="new-row">
      <Picker value={of} choices={placeable.map((c) => ({ id: c.id, label: c.name }))} placeholder="place an Instance of…" onChange={setOf} />
      {of && (
        <AddInline
          label={`Instance named ${suggested(of)}`}
          placeholder={suggested(of)}
          onAdd={(name) => void w.act("DeploymentEditor", "addInstance", { deployment: deployment.id, of, name }, { message: `Placed ${name}` }).then(() => setOf(undefined))}
        />
      )}
      {of && (
        <button className="primary small" onClick={() => void w.act("DeploymentEditor", "addInstance", { deployment: deployment.id, of, name: suggested(of) }, { message: `Placed ${suggested(of)}` }).then(() => setOf(undefined))}>
          Place
        </button>
      )}
    </div>
  );
}

function mediumOf(model: ReturnType<typeof useModel>, id: string | undefined) {
  const at = id === undefined || id === "" ? undefined : model.get(id);
  return at?.kind === "Medium" ? at.medium : undefined;
}

/** A Connection: its What, and the stack of Mediums it passes over, from the first down. */
function ConnectionCard({ connection, deployment, deployed }: { connection: ConnectionJson; deployment: DeploymentJson; deployed: ComponentJson }) {
  const w = useWorkspace();
  const model = useModel();
  const ref = useFocusRow(connection.id);
  const to = model.target(connection);
  const mediums = model.deploymentAccess(deployment.id, "mediums");
  const problems = [...w.about(connection.id), ...connection.mediations.flatMap((m) => w.about(m.id))];
  return (
    <div ref={ref} className={`connection-card row ${problems.length ? "has-problems" : ""}`}>
      <div className="connection-head">
        <Icon name="Connection" />
        <strong>{model.name(connection.from)}</strong> <span className="muted">uses</span>
        <Chips
          values={connection.what}
          label={(i) => `${model.name(i)}()`}
          icon="Interaction"
          choices={offeredAt(model, deployment, deployed, connection.toIdentity ?? to ?? "").map((i) => ({ id: i, label: `${model.name(i)}()` }))}
          onAdd={(i) => void w.act("DeploymentEditor", "setWhat", { connection: connection.id, what: [...connection.what, i] })}
          onRemove={(i) => connection.what.length > 1 && void w.act("DeploymentEditor", "setWhat", { connection: connection.id, what: connection.what.filter((x) => x !== i) })}
          onOpen={(i) => w.reveal(i)}
          addLabel="Interaction"
        />
        <span className="muted">of</span> <strong>{model.name(to)}</strong>
        <span className="row-tail">
          <Marks diagnostics={problems} />
          <IconButton icon="trash" label="Delete Connection" onClick={() => void w.act("DeploymentEditor", "remove", { item: connection.id }, { message: "Deleted Connection" })} />
        </span>
      </div>
      <ol className="mediation-stack">
        {connection.mediations.map((m, index) => {
          const medium = mediumOf(model, m.how);
          const broken = medium === undefined;
          const realized = m.down !== null || m.up !== null;
          // What this level carries: the Connection's What, or the call of the Medium above.
          const above = index === 0 ? undefined : mediumOf(model, connection.mediations[index - 1]!.how);
          const carried = index === 0 ? connection.what.map((i) => model.name(i)).join(", ") : model.name(above?.call);
          const whatLanguage = index === 0 ? model.interaction(connection.what[0])?.language : above?.language;
          return (
            <li key={m.id} className={`mediation-level ${broken ? "broken" : realized ? "realized" : "unrealized"}`}>
              <span className="level-what">
                {carried} <span className="muted">over</span>
              </span>
              <Picker
                value={broken ? undefined : m.how}
                choices={mediums.map((x) => ({ id: x, label: model.name(x), hint: model.name(mediumOf(model, x)?.language) }))}
                placeholder={broken ? "its Medium is gone" : "a Medium"}
                invalid={broken}
                onChange={(how) => how && void w.act("MediationEditor", "setHow", { mediation: m.id, medium: how })}
              />
              {broken ? (
                <Badge severity="error">broken</Badge>
              ) : realized ? (
                <span className="realization">
                  down by{" "}
                  <button className="link-chip" onClick={() => m.down && w.open({ kind: "transformation", id: m.down })}>
                    {model.name(m.down ?? undefined)}
                  </button>
                  , up by{" "}
                  <button className="link-chip" onClick={() => m.up && w.open({ kind: "transformation", id: m.up })}>
                    {model.name(m.up ?? undefined)}
                  </button>
                </span>
              ) : (
                <span className="realization">
                  <span className="muted">not realized</span>{" "}
                  {whatLanguage && (
                    <button className="small" onClick={() => void w.act("MediationEditor", "createRealization", { mediation: m.id }, { message: "Created the realization: now map what goes down, and what comes up" })}>
                      Create realization
                    </button>
                  )}
                </span>
              )}
              <IconButton icon="x" label="Remove this level" onClick={() => void w.act("MediationEditor", "remove", { mediation: m.id })} />
            </li>
          );
        })}
      </ol>
      <div className="stack-tail">
        {connection.mediations.length === 0 && <span className="muted">No Mediation: how it passes is left to the implementation.</span>}
        {mediums.length > 0 ? (
          <Picker
            value={undefined}
            choices={mediums.map((x) => ({ id: x, label: model.name(x) }))}
            placeholder={connection.mediations.length === 0 ? "+ mediate it over…" : "+ then over…"}
            onChange={(medium) => medium && void w.act("MediationEditor", "addMediation", { connection: connection.id, medium })}
          />
        ) : (
          <span className="muted">{deployment.name} has no Medium to mediate over: import one, as a need.</span>
        )}
      </div>
      <Description id={connection.id} className="row-description" />
    </div>
  );
}

/** Every identity a Deployment could import: a path of exposed placements from the root down, a few levels deep. */
function identityPaths(model: ReturnType<typeof useModel>, depth = 3): string[][] {
  const found: string[][] = [];
  const walk = (box: string, prefix: string[]) => {
    if (prefix.length >= depth) return;
    for (const d of model.deploymentsOf(box)) {
      for (const exposed of d.exposes) {
        const at = model.get(exposed.instance);
        if (at?.kind !== "Instance") continue;
        const path = [...prefix, exposed.instance];
        found.push(path);
        walk(at.instance.of, path);
      }
    }
  };
  walk(model.root.id, []);
  return found;
}

/** The identities a Deployment imports: real objects, by their paths from the root. */
function Identities({ deployment }: { deployment: DeploymentJson }) {
  const w = useWorkspace();
  const model = useModel();
  const own = deployment.imports.filter((i) => i.path !== undefined);
  const taken = new Set(own.map((i) => i.path!.join("/")));
  const paths = identityPaths(model).filter((path) => !taken.has(path.join("/")));
  const label = (path: string[]) => `/${path.map((p) => model.name(p)).join("/")}`;
  return (
    <Section title="Identities" icon="Instance" count={own.length} hint="real objects it relies on: paths of exposed placements from the root">
      {own.map((i) => (
        <div key={i.id} className="row">
          <Icon name="Instance" />
          <span className="cell-main">{label(i.path!)}</span>
          <Marks diagnostics={w.about(i.id)} />
          <IconButton icon="x" label={`Stop importing ${label(i.path!)}`} onClick={() => void w.act("DeploymentEditor", "remove", { item: i.id })} />
        </div>
      ))}
      {paths.length > 0 ? (
        <Picker
          value={undefined}
          placeholder="Import an identity…"
          choices={paths.map((path) => ({ id: path.join(" "), label: label(path) }))}
          onChange={(path) => path && void w.act("DeploymentEditor", "importIdentity", { deployment: deployment.id, path: path.split(" ") })}
        />
      ) : (
        own.length === 0 && <span className="muted">No placement is exposed: expose one in a Deployment of the root to reach it.</span>
      )}
    </Section>
  );
}
