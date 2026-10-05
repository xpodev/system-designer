/**
 * Descriptions: what something is and what it is for, in prose. They are written in a little
 * Markdown — paragraphs, lists, `code`, **bold**, *emphasis* and links — and shown as such, and
 * edited in place wherever the thing they describe is shown.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DESCRIBABLE } from "./model";
import { useModel, useWorkspace } from "./workspace";

/** A description's text as Markdown: blocks of paragraphs and lists, with inline marks. Nothing is rendered as HTML. */
export function Prose({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={`prose ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*[-*] /.test(line))) {
          return <ul key={i}>{lines.map((line, j) => <li key={j}>{inline(line.replace(/^\s*[-*] /, ""))}</li>)}</ul>;
        }
        if (lines.every((line) => /^\s*\d+[.)] /.test(line))) {
          return <ol key={i}>{lines.map((line, j) => <li key={j}>{inline(line.replace(/^\s*\d+[.)] /, ""))}</li>)}</ol>;
        }
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}

const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > at) out.push(text.slice(at, match.index));
    const [, code, strong, em, em2, label, href] = match;
    const key = out.length;
    if (code !== undefined) out.push(<code key={key}>{code}</code>);
    else if (strong !== undefined) out.push(<strong key={key}>{inline(strong)}</strong>);
    else if (em !== undefined || em2 !== undefined) out.push(<em key={key}>{inline((em ?? em2)!)}</em>);
    else
      out.push(
        <a key={key} href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {label}
        </a>,
      );
    at = match.index + match[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/**
 * Text written in place: shown as prose, edited on a click. Ctrl+Enter or leaving the field keeps
 * it, Escape gives it up; emptied, it is removed. Without text, a quiet invitation to write some.
 */
export function ProseText(props: { value: string | undefined; onCommit(text: string): unknown; placeholder: string; invite?: string; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!editing || !area.current) return;
    area.current.focus();
    area.current.setSelectionRange(area.current.value.length, area.current.value.length);
  }, [editing]);
  useLayoutEffect(() => {
    // Grow with the text, so a long description is edited whole.
    if (area.current) {
      area.current.style.height = "auto";
      area.current.style.height = `${area.current.scrollHeight + 2}px`;
    }
  }, [draft, editing]);
  const start = () => {
    setDraft(props.value ?? "");
    setEditing(true);
  };
  const stop = (keep: boolean) => {
    setEditing(false);
    const text = draft.trim();
    if (keep && text !== (props.value ?? "").trim()) props.onCommit(text);
  };
  if (editing) {
    return (
      <div className={`prose-editing ${props.className ?? ""}`} onClick={(event) => event.stopPropagation()}>
        <textarea
          ref={area}
          className="prose-input"
          value={draft}
          placeholder={props.placeholder}
          rows={2}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => stop(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              stop(true);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              stop(false);
            }
          }}
        />
        <span className="prose-hint">
          Markdown: <code>`code`</code> <b>**bold**</b> <i>*emphasis*</i> <code>- lists</code> · <kbd>Ctrl Enter</kbd> keep · <kbd>Esc</kbd> cancel
        </span>
      </div>
    );
  }
  if (!props.value) {
    return (
      <button
        className={`add-description ${props.className ?? ""}`}
        onClick={(event) => {
          event.stopPropagation();
          start();
        }}
      >
        {props.invite ?? "Add a description"}
      </button>
    );
  }
  return (
    <div
      className={`description ${props.className ?? ""}`}
      role="button"
      tabIndex={0}
      title="Click to edit the description"
      onClick={(event) => {
        event.stopPropagation();
        start();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          start();
        }
      }}
    >
      <Prose text={props.value} />
    </div>
  );
}

/** The description of the thing with this id, edited in place through the DocumentationEditor. */
export function Description({ id, className, invite }: { id: string; className?: string; invite?: string }) {
  const w = useWorkspace();
  const model = useModel();
  const kind = model.kind(id);
  if (!kind || !DESCRIBABLE.has(kind)) return null;
  const what = kind === "Formula" ? "axiom" : kind.toLowerCase();
  return (
    <ProseText
      value={model.description(id)}
      className={className}
      invite={invite}
      placeholder={`What is this ${what}, and what is it for?`}
      onCommit={(text) => void w.act("DocumentationEditor", "describe", { subject: id, text }, { quiet: true })}
    />
  );
}
