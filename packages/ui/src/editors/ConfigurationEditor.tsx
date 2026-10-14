/**
 * The Configuration editor: a whole System put together. From the root, each occupant of each
 * Instance gets a Choice: the Component that fills it — the Instance's own, or one implementing
 * it — and which of that Component's Deployments it runs as, and so on down; or it is left open.
 * An Instance of range `0..N` has as many Choices as it has occupants.
 */
import type { ChoiceJson, ComponentJson, ConfigurationJson, InstanceJson } from "../model";
import { Description } from "../prose";
import { Icon, Menu, Picker } from "../widgets";
import { useModel, useWorkspace } from "../workspace";
import { EditorHeader, Problems } from "./common";

export function ConfigurationEditor({ id }: { id: string }) {
  const w = useWorkspace();
  const model = useModel();
  const at = model.get(id);
  if (at?.kind !== "Configuration") return <p className="empty">This Configuration no longer exists.</p>;
  const configuration = at.configuration;
  const root = model.root;
  return (
    <div className="editor">
      <EditorHeader
        icon="Configuration"
        kind="Configuration"
        id={id}
        name={configuration.name}
        onRename={(name) => void w.act("ConfigurationEditor", "rename", { configuration: id, name })}
        summary="for each occupant of each Instance, what fills it, and how it is put together"
        actions={<Menu items={[{ label: "Delete Configuration", icon: "trash", danger: true, onSelect: () => void w.act("ConfigurationEditor", "remove", { configuration: id }, { message: `Deleted Configuration ${configuration.name}` }) }]} />}
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Configuration: when the System is put together this way" />
        <Problems ids={[id, configuration.root.id]} />
        <div className="choice-tree">
          <div className="choice-row root">
            <Icon name="Component" />
            <strong>{root.name}</strong>
            <span className="muted">is put together as</span>
            <Picker
              value={configuration.root.deployment ?? undefined}
              allowNone
              placeholder="left open"
              choices={root.deployments.map((d) => ({ id: d.id, label: d.name }))}
              onChange={(deployment) => void w.act("ConfigurationEditor", "changeChoice", { choice: configuration.root.id, component: root.id, ...(deployment ? { deployment } : {}) })}
            />
          </div>
          <Choices configuration={configuration} choice={configuration.root} depth={1} />
        </div>
      </div>
    </div>
  );
}

/** For each Instance of the Deployment chosen at `choice`: a Choice per occupant, and beneath each. */
function Choices({ configuration, choice, depth }: { configuration: ConfigurationJson; choice: ChoiceJson; depth: number }) {
  const model = useModel();
  const deployment = choice.deployment === null ? undefined : model.get(choice.deployment);
  if (deployment?.kind !== "Deployment") return null;
  return (
    <>
      {deployment.deployment.instances.map((instance) => (
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
  // What may fill the Instance: its own Component, or any Component implementing it.
  const fillers = [model.component(instance.of), ...model.components.filter((c) => c.implements.includes(instance.of))].filter((c): c is ComponentJson => c !== undefined);
  const more = instance.max === "N" || chosen.length < instance.max;
  return (
    <div>
      {chosen.map((c) => {
        const deployments = model.component(c.component)?.deployments ?? [];
        return (
          <div key={c.id}>
            <div className="choice-row" style={{ paddingLeft: depth * 22 }}>
              <Icon name="Instance" />
              <strong>{instance.name}</strong>
              <span className="muted">is filled by</span>
              <Picker
                value={c.component}
                choices={fillers.map((f) => ({ id: f.id, label: f.name }))}
                onChange={(component) => component && void w.act("ConfigurationEditor", "changeChoice", { choice: c.id, component })}
              />
              <span className="muted">put together as</span>
              {deployments.length === 0 ? (
                <span className="muted">— it has no Deployment</span>
              ) : (
                <Picker
                  value={c.deployment ?? undefined}
                  allowNone
                  placeholder="left open"
                  choices={deployments.map((d) => ({ id: d.id, label: d.name }))}
                  onChange={(deployment) => void w.act("ConfigurationEditor", "changeChoice", { choice: c.id, component: c.component, ...(deployment ? { deployment } : {}) })}
                />
              )}
              <Menu items={[{ label: "Remove this occupant's Choice", icon: "trash", danger: true, onSelect: () => void w.act("ConfigurationEditor", "unchoose", { choice: c.id }) }]} />
            </div>
            <Choices configuration={configuration} choice={c} depth={depth + 1} />
          </div>
        );
      })}
      {more && (
        <div className="choice-row" style={{ paddingLeft: depth * 22 }}>
          <Icon name="Instance" />
          <strong>{instance.name}</strong>
          <span className="muted">
            ({model.name(instance.of)}
            {chosen.length > 0 ? ", another occupant" : ""})
          </span>
          <Picker
            value={undefined}
            allowNone
            placeholder="left open"
            choices={fillers.map((f) => ({ id: f.id, label: f.name }))}
            onChange={(component) => component && void w.act("ConfigurationEditor", "choose", { parent: parent.id, instance: instance.id, component })}
          />
        </div>
      )}
    </div>
  );
}
