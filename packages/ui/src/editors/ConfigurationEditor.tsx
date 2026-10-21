/**
 * The Configuration editor: a whole System put together. From the root, each occupant of each
 * Instance gets a Choice: the Deployment of its box it runs — or none, leaving it an interface —
 * and so on down. An Instance of range `0..N` has as many Choices as it has occupants; one whose
 * Deployment the design fixes runs that one. One Configuration is current: the one verified.
 */
import type { ChoiceJson, ConfigurationJson, InstanceJson } from "../model";
import { Description } from "../prose";
import { Icon, Menu, Picker } from "../widgets";
import { useModel, useWorkspace } from "../workspace";
import { EditorHeader, Problems } from "./common";

/** The choice of no Deployment: an occupant left an interface. */
const INTERFACE = "#interface";

export function ConfigurationEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Configuration") return <p className="empty">This Configuration no longer exists.</p>;
  const configuration = at.configuration;
  const root = model.root;
  const current = model.current?.id === id;
  return (
    <div className="editor">
      <EditorHeader
        icon="Configuration"
        kind="Configuration"
        id={id}
        name={configuration.name}
        onRename={(name) => void w.act("ConfigurationEditor", "rename", { configuration: id, name })}
        summary={current ? "the current Configuration: the one verified" : "for each occupant of each Instance, the Deployment it runs"}
        actions={
          <Menu
            items={[
              ...(current ? [] : [{ label: "Make current", icon: "check", onSelect: () => void w.act("ConfigurationEditor", "setCurrent", { configuration: id }, { message: `${configuration.name} is now current` }) }]),
              { label: "Delete Configuration", icon: "trash", danger: true, onSelect: () => void w.act("ConfigurationEditor", "remove", { configuration: id }, { message: `Deleted Configuration ${configuration.name}` }) },
            ]}
          />
        }
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Configuration: when the System is put together this way" />
        <Problems ids={[id, configuration.root.id]} />
        <div className="choice-tree">
          <div className="choice-row root">
            <Icon name="Component" />
            <strong>{root.name}</strong>
            <span className="muted">is solved by</span>
            <Picker
              value={configuration.root.deployment ?? undefined}
              allowNone
              placeholder="left open"
              choices={model.deploymentsOf(root.id).map((d) => ({ id: d.id, label: d.name }))}
              onChange={(deployment) => void w.act("ConfigurationEditor", "changeChoice", { choice: configuration.root.id, ...(deployment ? { deployment } : {}) })}
            />
          </div>
          <Choices configuration={configuration} choice={configuration.root} running={configuration.root.deployment} depth={1} />
        </div>
      </div>
    </div>
  );
}

/** For each placement of the Deployment running at `choice`: a Choice per occupant, and beneath each. */
function Choices({ configuration, choice, running, depth }: { configuration: ConfigurationJson; choice: ChoiceJson; running: string | null; depth: number }) {
  const model = useModel();
  const deployment = model.deployment(running);
  if (deployment === undefined) return null;
  return (
    <>
      {deployment.instances.map((instance) => (
        <Occupants key={instance.id} configuration={configuration} parent={choice} instance={instance} depth={depth} />
      ))}
    </>
  );
}

/** The occupants of one Instance: each one's Choice, and a way to add one while its range allows. */
function Occupants({ configuration, parent, instance, depth }: { configuration: ConfigurationJson; parent: ChoiceJson; instance: InstanceJson; depth: number }) {
  const w = useWorkspace();
  const model = useModel();
  const chosen = parent.choices.filter((c) => c.instance === instance.id);
  // What the occupant may run: a Deployment of its box, wherever it is kept; or none.
  const options = [{ id: INTERFACE, label: "an interface (no Deployment)" }, ...model.deploymentsOf(instance.of).map((d) => ({ id: d.id, label: d.name }))];
  const fixed = instance.runs ?? undefined;
  const more = instance.max === "N" || chosen.length < instance.max;
  return (
    <div>
      {chosen.map((c) => {
        const running = c.deployment ?? instance.runs;
        return (
          <div key={c.id}>
            <div className="choice-row" style={{ paddingLeft: depth * 22 }}>
              <Icon name="Instance" />
              <strong>{instance.name}</strong>
              <span className="muted">({model.name(instance.of)}) runs</span>
              {fixed !== undefined ? (
                <span>
                  {model.name(fixed)} <span className="muted">— fixed by the design</span>
                </span>
              ) : (
                <Picker
                  value={c.deployment ?? INTERFACE}
                  choices={options}
                  onChange={(deployment) => deployment && void w.act("ConfigurationEditor", "changeChoice", { choice: c.id, ...(deployment === INTERFACE ? {} : { deployment }) })}
                />
              )}
              <Menu items={[{ label: "Remove this occupant's Choice", icon: "trash", danger: true, onSelect: () => void w.act("ConfigurationEditor", "unchoose", { choice: c.id }) }]} />
            </div>
            <Choices configuration={configuration} choice={c} running={running} depth={depth + 1} />
          </div>
        );
      })}
      {more && (
        <div className="choice-row" style={{ paddingLeft: depth * 22 }}>
          <Icon name="Instance" />
          <strong>{instance.name}</strong>
          <span className="muted">
            ({model.name(instance.of)}
            {chosen.length > 0 ? ", another occupant" : ""}){fixed !== undefined ? `, runs ${model.name(fixed)}` : ""}
          </span>
          <Picker
            value={undefined}
            allowNone
            placeholder={fixed !== undefined ? "choose, to configure inside it" : "left open"}
            choices={fixed !== undefined ? [{ id: fixed, label: model.name(fixed) }] : options}
            onChange={(deployment) =>
              deployment && void w.act("ConfigurationEditor", "choose", { parent: parent.id, instance: instance.id, ...(deployment === INTERFACE || deployment === fixed ? {} : { deployment }) })
            }
          />
        </div>
      )}
    </div>
  );
}
