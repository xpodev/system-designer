/**
 * The Documentation: the whole System written up as one document — every Language, Domain and
 * Mediation with what it is for, each Relationship read both ways, and the rules the System is
 * verified against with their own documentation. Every description is written in place here,
 * as in the editors; the document goes out as Markdown.
 */
import { useEffect, useState } from "react";
import { api, type Documentation } from "./api";
import { DESCRIBABLE } from "./model";
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

  return (
    <article className="document documentation">
      <Description id={doc.system.id} className="lead" invite="Describe this System: what it is, and what it is for" />

      <nav className="doc-contents" aria-label="Contents">
        {(
          [
            ["Languages", "Language", doc.languages],
            ["Domains", "Domain", doc.domains],
            ["Mediations", "Mediation", doc.mediations],
          ] as const
        ).map(
          ([title, icon, items]) =>
            items.length > 0 && (
              <div key={title}>
                <h4>
                  <Icon name={icon} size={14} /> {title}
                </h4>
                <ul>
                  {items.map((item) => (
                    <li key={item.id}>
                      <a href={`#${anchor(icon, item.id)}`} onClick={(e) => (e.preventDefault(), jump(anchor(icon, item.id)))}>
                        {item.name}
                      </a>
                      {!item.description && <span className="undescribed" title="Not described yet" />}
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
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

      {doc.languages.length > 0 && <h2>Languages</h2>}
      {doc.languages.map((language) => (
        <section key={language.id} id={anchor("Language", language.id)} className="doc-section">
          <h3>
            <Icon name="Language" size={18} className="k-language" /> <Name id={language.id}>{language.name}</Name>
          </h3>
          <Description id={language.id} invite="Describe this Language" />
          <p className="doc-meta">{language.usedBy.length ? `Used by ${language.usedBy.join(", ")}.` : "No Domain uses it yet."}</p>

          {language.entities.length > 0 && (
            <>
              <h4>Entities</h4>
              <dl className="doc-list">
                {language.entities.map((entity) => (
                  <div key={entity.id}>
                    <dt>
                      <Name id={entity.id} className="entity-name">
                        {entity.name}
                      </Name>
                      {entity.comparedBy && <span className="doc-meta"> compared by {entity.comparedBy}</span>}
                    </dt>
                    <dd>
                      <Description id={entity.id} />
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {language.relationships.length > 0 && (
            <>
              <h4>Relationships</h4>
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
            </>
          )}

          {language.interactions.length > 0 && (
            <>
              <h4>Interactions</h4>
              <dl className="doc-list">
                {language.interactions.map((interaction) => (
                  <div key={interaction.id}>
                    <dt>
                      <Name id={interaction.id} className="mono">
                        {interaction.signature}
                      </Name>
                      {interaction.action && <Badge severity="info">Action on {interaction.action}</Badge>}
                    </dt>
                    <dd>
                      <Description id={interaction.id} />
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {language.axioms.length > 0 && (
            <>
              <h4>Axioms</h4>
              <dl className="doc-list">
                {language.axioms.map((axiom) => (
                  <div key={axiom.id}>
                    <dt>
                      <Name id={axiom.id} className="mono">
                        {axiom.text}
                      </Name>
                      {axiom.constrains && <span className="doc-meta"> on {axiom.constrains}</span>}
                    </dt>
                    <dd>
                      <Description id={axiom.id} invite="Say what this axiom means" />
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      ))}

      {doc.domains.length > 0 && <h2>Domains</h2>}
      {doc.domains.map((domain) => (
        <section key={domain.id} id={anchor("Domain", domain.id)} className="doc-section">
          <h3>
            <Icon name="Domain" size={18} className="k-domain" /> <Name id={domain.id}>{domain.name}</Name>
          </h3>
          <Description id={domain.id} invite="Describe this Domain" />
          <p className="doc-meta">
            Uses {domain.languages.join(", ") || "no Language of its own"}
            {domain.references.length > 0 && <>; builds on {domain.references.join(", ")}</>}.
          </p>
          {domain.transformations.map((t) => (
            <div key={t.id} className="doc-transformation">
              <h4>
                <Icon name="Transformation" size={15} /> <Name id={t.id}>{t.name}</Name>{" "}
                <span className="doc-meta">
                  a {t.kind}, {t.source} → {t.target}
                </span>
              </h4>
              <Description id={t.id} invite="Describe this Transformation" />
              {(t.mappings.length > 0 || t.deferred.length > 0) && (
                <ul className="mappings">
                  {t.mappings.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                  {t.deferred.map((d) => (
                    <li key={d} className="deferred">
                      {d} — deliberately left unmapped
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}

      {doc.mediations.length > 0 && <h2>Mediations</h2>}
      {doc.mediations.map((mediation) => (
        <section key={mediation.id} id={anchor("Mediation", mediation.id)} className="doc-section">
          <h3>
            <Icon name="Mediation" size={18} className="k-mediation" /> <Name id={mediation.id}>{mediation.name}</Name>
          </h3>
          <p className="doc-meta">
            {mediation.what} is carried out over {mediation.how}; only {mediation.mediator} knows both.
          </p>
          <Description id={mediation.id} invite="Describe this Mediation" />
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
