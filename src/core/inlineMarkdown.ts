export type InlineNode =
  | { type: "text"; value: string }
  | { type: "bold"; children: InlineNode[] }
  | { type: "italic"; children: InlineNode[] }
  | { type: "code"; value: string }
  | { type: "link"; label: InlineNode[]; url: string }
  | { type: "wikilink"; target: string; alias?: string };

/**
 * A small, intentionally limited inline-markdown parser: bold, italic,
 * inline code, [text](url) links, and [[wikilinks]]. No block elements
 * (paragraphs, lists, headings, embeds, tables) — this only ever runs on
 * a single run of inline fold content, so block structure isn't
 * meaningful here.
 *
 * This deliberately doesn't reuse Obsidian's own MarkdownRenderer. That
 * renderer is async and produces block-level output (wrapped in <p>),
 * which would need unwrapping to stay inline and can't be awaited
 * inside a synchronous CM6 widget's toDOM(). A small synchronous parser
 * covers the realistic "make my flashcard answer look nice" case
 * without that async/sync mismatch.
 *
 * No backslash-escaping is supported (e.g. `\*` isn't a literal
 * asterisk) — kept deliberately simple.
 */
export function parseInlineMarkdown(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";
  let i = 0;

  const flush = (): void => {
    if (buffer) {
      nodes.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < text.length) {
    const match = matchCode(text, i) ?? matchWikilink(text, i) ?? matchLink(text, i) ?? matchEmphasis(text, i);
    if (match) {
      flush();
      nodes.push(match.node);
      i = match.next;
      continue;
    }
    buffer += text[i];
    i++;
  }

  flush();
  return nodes;
}

interface Match {
  node: InlineNode;
  next: number;
}

function matchCode(text: string, i: number): Match | null {
  if (text[i] !== "`") return null;
  const end = text.indexOf("`", i + 1);
  if (end === -1 || end === i + 1) return null; // no empty code spans
  return { node: { type: "code", value: text.slice(i + 1, end) }, next: end + 1 };
}

function matchWikilink(text: string, i: number): Match | null {
  if (!text.startsWith("[[", i)) return null;
  const end = text.indexOf("]]", i + 2);
  if (end === -1 || end === i + 2) return null;
  const inner = text.slice(i + 2, end);
  const pipeIndex = inner.indexOf("|");
  const node: InlineNode =
    pipeIndex === -1
      ? { type: "wikilink", target: inner }
      : { type: "wikilink", target: inner.slice(0, pipeIndex), alias: inner.slice(pipeIndex + 1) };
  return { node, next: end + 2 };
}

function matchLink(text: string, i: number): Match | null {
  if (text[i] !== "[") return null;
  // Simple (non-nested-bracket) label matching — real markdown allows
  // nested brackets in link labels, but that's a rare enough case to
  // not be worth the extra complexity for inline fold content.
  const labelEnd = text.indexOf("]", i + 1);
  if (labelEnd === -1 || text[labelEnd + 1] !== "(") return null;
  const urlEnd = text.indexOf(")", labelEnd + 2);
  if (urlEnd === -1) return null;
  const label = text.slice(i + 1, labelEnd);
  const url = text.slice(labelEnd + 2, urlEnd);
  return { node: { type: "link", label: parseInlineMarkdown(label), url }, next: urlEnd + 1 };
}

function matchEmphasis(text: string, i: number): Match | null {
  // Two-character markers checked first so "**bold**" isn't misread as
  // an empty italic span followed by more asterisks.
  for (const marker of ["**", "__"]) {
    if (text.startsWith(marker, i)) {
      const end = text.indexOf(marker, i + marker.length);
      if (end !== -1 && end > i + marker.length) {
        return {
          node: { type: "bold", children: parseInlineMarkdown(text.slice(i + marker.length, end)) },
          next: end + marker.length,
        };
      }
    }
  }
  for (const marker of ["*", "_"]) {
    if (text.startsWith(marker, i)) {
      const end = text.indexOf(marker, i + marker.length);
      if (end !== -1 && end > i + marker.length) {
        return {
          node: { type: "italic", children: parseInlineMarkdown(text.slice(i + marker.length, end)) },
          next: end + marker.length,
        };
      }
    }
  }
  return null;
}
