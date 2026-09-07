import { FoldNode } from "./types";

/**
 * Derives a stable identity for every fold node in a parsed document.
 *
 * Identity is (classId + content), NOT position. That's the fix for the
 * old plugin's two state bugs: raw offsets drift as the document is
 * edited and don't survive a reload, and they aren't comparable between
 * Live Preview and Reading view at all. Content-based keys are stable
 * across edits elsewhere in the file, across view-mode switches, and
 * across restarts.
 *
 * Duplicate class+content pairs in the same document (e.g. the same
 * flashcard answer used twice) are disambiguated by occurrence order —
 * call this once across a whole document's root nodes so the ordering
 * is consistent everywhere it's used (Live Preview, Reading view, and
 * commands all parse independently and must agree on the same keys).
 */
export function assignFoldKeys(roots: FoldNode[]): Map<FoldNode, string> {
  const seen = new Map<string, number>();
  const keys = new Map<FoldNode, string>();

  const visit = (nodes: FoldNode[]): void => {
    for (const node of nodes) {
      const base = `${node.classId}::${node.content}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      keys.set(node, occurrence === 0 ? base : `${base}::${occurrence}`);
      if (node.children.length > 0) visit(node.children);
    }
  };

  visit(roots);
  return keys;
}

/** Flattens a fold tree (roots + all descendants) into one array. */
export function flattenFoldTree(roots: FoldNode[]): FoldNode[] {
  const out: FoldNode[] = [];
  const visit = (nodes: FoldNode[]): void => {
    for (const node of nodes) {
      out.push(node);
      if (node.children.length > 0) visit(node.children);
    }
  };
  visit(roots);
  return out;
}
