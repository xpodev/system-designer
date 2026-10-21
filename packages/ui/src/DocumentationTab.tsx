/**
 * The Documentation: the whole System written up as one document — every Component, nested,
 * with its Languages, Interactions, Transformations, Mediums and Deployments and what each is
 * for, each Relationship read both ways, the Configurations, and the rules the System is
 * verified against with their own documentation. Every description is written in place here,
 * as in the editors; the document goes out as Markdown.
 */
import { useEffect, useState } from "react";
import { api, type Documentation } from "./api";
import { DESCRIBABLE, type ChoiceJson } from "./model";
import { Description, Prose } from "./prose";
import { Badge, download, Icon } from "./widgets";
import { useModel, useWorkspace } from "./workspace";

export function DocumentationTab() {
  const w = useWorkspace();
  const model = useModel();
  const [doc, setDoc] = useState<{ documentation: Documentation; markdown: string }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    setError(undefined);
    void api.documentation(w.context).then(setDoc, (e) => setError(e.message));
  }, [w.context, w.version, w.run]);

  // How much of the System is described: everything that can be, against what is.
  const describable = [...model.byId.keys()].filter((id) => DESCRIBABLE.has(model.kind(id)!));
  const described = describable.filter((id) => model.description(id));
  const file = `${(model.system.name.replace(/\W+/g, "-").toLowerCase() || "system")}.md`;

  return (
    <div className="editor">
      <header className="editor-header compact">
        <div className="editor-icon view">
          <Icon name="book" size={22} />
        </div>
        <div className="editor-title">
          <span className="editor-kind">Documentation</span>
          <h1>{model.system.name}</h1>
          <span className="editor-summary">
            {described.length} of {describable.length} things described · click any description to write it
          </span>
        </div>
        <div className="editor-actions">
          <button disabled={!doc} onClick={() => doc && void navigator.clipboard.writeText(doc.markdown).then(() => w.notify("Copied the Markdown", "ok"))}>
            Copy Markdown
          </button>
          <button className="primary" disabled={!doc} onClick={() => doc && download(file, doc.markdown, "text/markdown")} title={`Download ${file}`}>
            <Icon name="download" /> Markdown
          </button>
        </div>
      </header>
      <div className="editor-body">
        {error ? (
          <p className="inline-problem error">{error}</p>
        ) : doc === undefined ? (
          <p className="empty">Loading…</p>
        ) : (
          <Document doc={doc.documentation} />
        )}
      </div>
    </div>
  );
}

type ComponentDoc = Documentation["components"][number];
type LanguageDoc = ComponentDoc["languages"][number];

function Document({ doc }: { doc: Documentation }) {
  const w = useWorkspace();
  const model = useModel();
  /** A name that opens where the thing is edited. */
  const Name = ({ id, children, className = "" }: { id: string; children: React.ReactNode; className?: string }) =>
    model.get(id) ? (
      <button className={`doc-name ${className}`} onClick={() => w.reveal(id)} title="Open it where it is edited">
        {children}
      </button>
    ) : (
      <span className={className}>{children}</span>
    );
  const anchor = (kind: string, id: string) => `doc-${kind}-${id}`.replace(/[^\w-]/g, "-");
  const jump = (target: string) => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const flat = (components: readonly ComponentDoc[], depth = 0): { component: ComponentDoc; depth: number }[] =>
    components.flatMap((component) => [{ component, depth }, ...flat(component.components, depth + 1)]);

  const languageSection = (language: LanguageDoc) => (
    <section key={language.id} className="doc-language">
      <h4>
        <Icon name="Language" size={16} className="k-language" /> <Name id={language.id}>{language.name}</Name>{" "}
        <span className="doc-meta">{language.extends.length ? `extends ${language.extends.join(", ")}` : "a core Language"}</span>
      </h4>
      <Description id={language.id} invite="Describe this Language" />
      <p className="doc-meta">{language.usedBy.length ? `Used by ${language.usedBy.join(", ")}.` : "No Component uses it yet."}</p>
      {language.entities.length > 0 && (
        <dl className="doc-list">
          {language.entities.map((entity) => (
            <div key={entity.id}>
              <dt>
                <Name id={entity.id} className="entity-name">
                  {entity.name}
                </Name>
                {entity.extends.length > 0 && <span className="doc-meta"> : {entity.extends.join(", ")}</span>}
              </dt>
              <dd>
                <Description id={entity.id} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {language.relationships.map((relationship) => (
        <div key={relationship.id} className="doc-relationship">
          <Name id={relationship.id} className="mono">
            {relationship.name}
          </Name>
          <ul className="readings">
            {relationship.navigations.map((n) => (
              <li key={n.end} className={n.by === null ? "unnamed" : ""}>
                <code className="range-chip">
                  {n.min}..{n.max ?? "N"}
                </code>{" "}
                {n.reading}
              </li>
            ))}
          </ul>
          <Description id={relationship.id} />
        </div>
      ))}
      {language.axioms.length > 0 && (
        <dl className="doc-list">
          {language.axioms.map((axiom) => (
            <div key={axiom.id}>
              <dt>
                <Name id={axiom.id} className="mono">
                  {axiom.text}
                </Name>
              </dt>
              <dd>
                <Description id={axiom.id} invite="Say what this axiom means" />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );

  const componentSection = (component: ComponentDoc, depth: number) => (
    <section key={component.id} id={anchor("Component", component.id)} className="doc-section" style={{ marginLeft: Math.min(depth, 4) * 16 }}>
      <h3>
        <Icon name="Component" size={18} className="k-component" /> <Name id={component.id}>{component.name}</Name>
      </h3>
      <Description id={component.id} invite="Describe this Component" />
      <p className="doc-meta">
        Uses {component.uses.join(", ") || "no Language yet"}
        {component.imports.length > 0 && <>; imports {component.imports.join("; ")}</>}.
      </p>
      {component.exports.length > 0 && <p className="doc-meta">Exports {component.exports.join(", ")}.</p>}
      {component.languages.map(languageSection)}
      {component.interactions.length > 0 && (
        <>
          <h4>Interactions</h4>
          <dl className="doc-list">
            {component.interactions.map((interaction) => (
              <div key={interaction.id}>
                <dt>
                  <Name id={interaction.id} className="mono">
                    {interaction.signature}
                  </Name>
                </dt>
                <dd>
                  <Description id={interaction.id} />
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {component.transformations.map((t) => (
        <div key={t.id} className="doc-transformation">
          <h4>
            <Icon name="Transformation" size={15} /> <Name id={t.id}>{t.name}</Name>{" "}
            <span className="doc-meta">
              {t.source} → {t.target}
            </span>
          </h4>
          <p className="mono doc-meta">{t.signature}</p>
          <Description id={t.id} invite="Describe this Transformation" />
        </div>
      ))}
      {component.mediums.map((m) => (
        <p key={m.id} className="doc-meta">
          <Icon name="Medium" size={14} /> Medium <Name id={m.id}>{m.name}</Name>: over {m.language}, through {m.call}.
        </p>
      ))}
      {component.deployments.map((d) => (
        <div key={d.id} className="doc-transformation">
          <h4>
            <Icon name="Deployment" size={15} /> <Name id={d.id}>{d.name}</Name> <span className="doc-meta">places {d.instances.join(", ") || "nothing"}</span>
          </h4>
          <Description id={d.id} invite="Describe this Deployment" />
          {d.connections.length > 0 && (
            <ul className="mappings">
              {d.connections.map((c) => (
                <li key={c.id}>
                  {c.from} uses {c.what.join(", ")} of {c.to}, {c.mediations.length ? `over ${c.mediations.join(", then ")}` : "how it passes left to the implementation"}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );

  const [root, ...packages] = doc.components;
  return (
    <article className="document documentation">
      <Description id={doc.system.id} className="lead" invite="Describe this System: what it is, and what it is for" />

      <nav className="doc-contents" aria-label="Contents">
        <div>
          <h4>
            <Icon name="Component" size={14} /> Components
          </h4>
          <ul>
            {flat(doc.components).map(({ component, depth }) => (
              <li key={component.id} style={{ paddingLeft: depth * 12 }}>
                <a href={`#${anchor("Component", component.id)}`} onClick={(e) => (e.preventDefault(), jump(anchor("Component", component.id)))}>
                  {component.name}
                </a>
                {!component.description && <span className="undescribed" title="Not described yet" />}
              </li>
            ))}
          </ul>
        </div>
        {doc.rules.length > 0 && (
          <div>
            <h4>
              <Icon name="play" size={14} /> Rules
            </h4>
            <ul>
              <li>
                <a href="#doc-rules" onClick={(e) => (e.preventDefault(), jump("doc-rules"))}>
                  {doc.rules.length} verification rules
                </a>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {root && flat([root]).map(({ component, depth }) => componentSection(component, depth))}
      {packages.length > 0 && <h2>Packages</h2>}
      {flat(packages).map(({ component, depth }) => componentSection(component, depth))}

      {model.configurations.length > 0 && <h2>Configurations</h2>}
      {model.configurations.map((c) => (
        <section key={c.id} className="doc-section">
          <h3>
            <Icon name="Configuration" size={18} /> <Name id={c.id}>{c.name}</Name>
          </h3>
          <Description id={c.id} invite="Describe this Configuration" />
          <ul className="mappings">
            {choiceLines(model, c.root).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}

      <h2 id="doc-rules">Verification rules</h2>
      {doc.rules.length === 0 ? (
        <p className="muted">
          Verify the System to include the rules it is verified against.{" "}
          <button className="small" disabled={w.structural > 0} onClick={() => void w.verify()}>
            Verify
          </button>
        </p>
      ) : (
        <div className="rule-docs">
          {doc.rules.map((rule) => (
            <RuleDoc key={rule.name} rule={rule} />
          ))}
        </div>
      )}
    </article>
  );
}

/** A rule: what it checks, and — folded, since it can be long — what it is for, as its docstring says. */
export function RuleDoc({ rule, open, onName }: { rule: { name: string; severity: string; about: string; doc?: string; script: string }; open?: boolean; onName?(): void }) {
  const more = rule.doc ? rule.doc.split(/\n\s*\n/).slice(1).join("\n\n").trim() : "";
  return (
    <div className="rule-doc">
      <div className="rule-head">
        <Badge severity={rule.severity === "error" ? "error" : "warning"}>{rule.severity}</Badge>
        {onName ? (
          <button className="rule-name" onClick={onName} title="Go to the rule">
            <code>{rule.name}</code>
          </button>
        ) : (
          <code className="rule-name">{rule.name}</code>
        )}
        {rule.script === "std" && <span className="muted">standard</span>}
      </div>
      {rule.about ? <p className="rule-about">{rule.about}</p> : <p className="rule-about muted">No docstring: say what it checks in one.</p>}
      {more && (
        <details className="rule-more" open={open}>
          <summary>What it is for</summary>
          <Prose text={more} />
        </details>
      )}
    </div>
  );
}

/** A Configuration's Choices, one line each, down the tree: `server runs Single`. */
function choiceLines(model: ReturnType<typeof useModel>, choice: ChoiceJson): string[] {
  const runs = choice.deployment === null ? "is an interface" : `runs ${model.name(choice.deployment)}`;
  const line = choice.instance === null ? (choice.deployment === null ? "the root, left open" : `the root is solved by ${model.name(choice.deployment)}`) : `${model.name(choice.instance)} ${runs}`;
  return [line, ...choice.choices.flatMap((c) => choiceLines(model, c))];
}
