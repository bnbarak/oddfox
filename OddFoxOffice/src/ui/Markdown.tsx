import type { ReactNode } from "react";

/* The small slice of Markdown the agent actually writes.

   It answers in prose with **bold** labels, `code` for ids, and dash or
   numbered lists — which, printed raw, turn a tidy list of campaigns into a
   wall of asterisks. This renders that much and nothing else: no tables, no
   images, no HTML. A full parser would be a dependency and a sanitiser for
   syntax nobody is emitting.

   Anything it does not recognise is printed as written, so an odd line is
   dull rather than wrong. */

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\*([^*\n]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** **bold**, `code`, *italic* and [links](url), in one pass over the line. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${at}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<code key={k}>{m[2]}</code>);
    else if (m[3] !== undefined) out.push(<em key={k}>{m[3]}</em>);
    else out.push(
      <a key={k} href={m[5]} target="_blank" rel="noreferrer">{m[4]}</a>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Item = { text: string; depth: number };
type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: Item[] };

const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const NUMBER = /^(\s*)\d+[.)]\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

function blocks(src: string): Block[] {
  const out: Block[] = [];
  for (const line of src.replace(/\r\n?/g, "\n").split("\n")) {
    const bullet = BULLET.exec(line);
    const number = bullet ? null : NUMBER.exec(line);
    const list = bullet ?? number;
    const heading = list ? null : HEADING.exec(line);
    const last = out[out.length - 1];

    if (list) {
      const kind = bullet ? "ul" : "ol";
      const item = { text: list[2], depth: Math.min(2, list[1].length >> 1) };
      if (last?.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else if (heading) {
      out.push({ kind: "h", text: heading[1] });
    } else if (!line.trim()) {
      // A blank line ends whatever was open; runs of them collapse.
      if (last?.kind === "p" || last?.kind === "ul" || last?.kind === "ol") out.push({ kind: "p", lines: [] });
    } else if (last?.kind === "p") {
      last.lines.push(line);
    } else {
      out.push({ kind: "p", lines: [line] });
    }
  }
  return out.filter((b) => b.kind !== "p" || b.lines.length > 0);
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className ? `of-md ${className}` : "of-md"}>
      {blocks(text).map((b, i) => {
        if (b.kind === "h") return <p key={i} className="of-md__h">{inline(b.text, `${i}`)}</p>;
        if (b.kind === "p") return <p key={i}>{inline(b.lines.join("\n"), `${i}`)}</p>;
        const items = b.items.map((it, j) => (
          <li key={j} data-depth={it.depth || undefined}>{inline(it.text, `${i}-${j}`)}</li>
        ));
        return b.kind === "ul" ? <ul key={i}>{items}</ul> : <ol key={i}>{items}</ol>;
      })}
    </div>
  );
}
