import { EditorSelection, EditorState, Extension, Transaction } from "@codemirror/state";
import { editorInfoField, editorLivePreviewField } from "obsidian";
import { FoldParser } from "../core/parser";
import { assignFoldKeys } from "../core/foldTree";
import { PluginDataStore } from "../data/PluginDataStore";

/**
 * When linkCursorToExpansion is "atomicOnCollapse", makes a collapsed
 * fold act like a single atomic character for cursor movement — landing
 * inside one snaps the cursor to whichever boundary it's closer to,
 * instead of letting the caret sit inside hidden text.
 */
export function createCursorBehavior(dataStore: PluginDataStore): Extension {
  return EditorState.transactionFilter.of((tr: Transaction) => {
    if (!tr.selection) return tr;

    const settings = dataStore.getSettings();
    if (settings.linkCursorToExpansion !== "atomicOnCollapse") return tr;
    if (!tr.state.field(editorLivePreviewField, false)) return tr;

    const filePath = tr.state.field(editorInfoField, false)?.file?.path;
    if (!filePath) return tr;

    const parser = new FoldParser(settings.classes);
    const prevHead = tr.startState.selection.main.head;
    let changed = false;

    const mapped = tr.selection.ranges.map((range) => {
      try {
        const line = tr.state.doc.lineAt(range.head);
        const nodes = parser.parseLine(line.text, line.from);
        // Line-scoped keys, not whole-document ones: this runs on every
        // cursor move, so a full-document parse here isn't worth the
        // cost. The only effect of a mismatch is that atomic-skip could
        // be slightly wrong for a fold whose class+content is duplicated
        // elsewhere in the file — a cosmetic edge case, not a data issue.
        const keys = assignFoldKeys(nodes);

        for (const node of nodes) {
          if (node.content === "") continue;
          if (prevHead > node.from && prevHead < node.to) continue; // already inside — let free editing continue

          const key = keys.get(node) as string;
          if (dataStore.isExpanded(filePath, key)) continue; // expanded folds aren't atomic

          if (range.head > node.from && range.head < node.to) {
            changed = true;
            if (prevHead <= node.from) return EditorSelection.cursor(node.to);
            if (prevHead >= node.to) return EditorSelection.cursor(node.from);
            return range.head - node.from > node.to - range.head
              ? EditorSelection.cursor(node.to)
              : EditorSelection.cursor(node.from);
          }
        }
      } catch {
        // malformed/mid-edit line — fall through and leave this range alone
      }
      return range;
    });

    return changed ? [tr, { selection: EditorSelection.create(mapped) }] : tr;
  });
}
