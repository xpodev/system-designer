/**
 * The Configuration editor: a whole System put together. A Deployment of the root first, then,
 * for each Instance it places, one of that Instance's Component's Deployments, and so on down —
 * or left open. The same Component may be put together differently in different places.
 */
import type { ChoiceJson, ConfigurationJson, DeploymentJson } from "../model";
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
        summary="a Deployment for the root, and for each Instance, down"
        actions={<Menu items={[{ label: "Delete Configuration", icon: "trash", danger: true, onSelect: () => void w.act("ConfigurationEditor", "remove", { configuration: id }, { message: `Deleted Configuration ${configuration.name}` }) }]} />}
      />
      <div className="editor-body">
        <Description id={id} className="about" invite="Describe this Configuration: when the System is put together this way" />
        <Problems ids={[id, configuration.root.id]} />
        <div className="choice-tree">
          <div className="choice-row root">
            <Icon name="Component" />
            <strong>{root?.name ?? "the root"}</strong>
            <span className="muted">is put together as</span>
            <Picker
              value={configuration.root.deployment || undefined}
              choices={(root?.deployments ?? []).map((d) => ({ id: d.id, label: d.name }))}
              onChange={(deployment) => deployment && void w.act("ConfigurationEditor", "setRoot", { configuration: id, deployment })}
            />
          </div>
          <Choices configuration={configuration} choice={configuration.root} depth={1} />
        </div>
      </div>
    </div>
  );
}

/** For each Instance of the Deployment chosen at `choice`: which of its Component's Deployments, and beneath it. */
function Choices({ configuration, choice, depth }: { configuration: ConfigurationJson; choice: ChoiceJson; depth: number }) {
  const w = useWorkspace();
  const model = useModel();
  const deployment = model.get(choice.deployment);
  if (deployment?.kind !== "Deployment") return null;
  return (
    <>
      {deployment.deployment.instances.map((instance) => {
        const chosen = choice.choices.find((c) => c.instance === instance.id);
        const options: DeploymentJson[] = model.component(instance.of)?.deployments ?? [];
        return (
          <div key={instance.id}>
            <div className="choice-row" style={{ paddingLeft: depth * 22 }}>
              <Icon name="Instance" />
              <strong>{instance.name}</strong>
              <span className="muted">({model.name(instance.of)})</span>
              <span className="muted">is put together as</span>
              {options.length === 0 ? (
                <span className="muted">— its Component has no Deployment</span>
              ) : (
                <Picker
                  value={chosen?.deployment}
                  allowNone
                  placeholder="left open"
                  choices={options.map((d) => ({ id: d.id, label: d.name }))}
                  onChange={(d) =>
                    d
                      ? void w.act("ConfigurationEditor", "choose", { choice: choice.id, instance: instance.id, deployment: d })
                      : chosen && void w.act("ConfigurationEditor", "unchoose", { choice: chosen.id })
                  }
                />
              )}
            </div>
            {chosen && <Choices configuration={configuration} choice={chosen} depth={depth + 1} />}
          </div>
        );
      })}
    </>
  );
}
