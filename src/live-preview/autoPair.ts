import { EditorSelection, EditorState, Extension, Transaction } from "@codemirror/state";
import { computeAutoPairEndSymbol } from "../core/autoPair";
import { PluginDataStore } from "../data/PluginDataStore";

/**
 * Auto-inserts a class's end symbol once its start symbol has just been
 * typed, cursor left sitting between the two — mirrors how Obsidian
 * already auto-closes brackets and quotes.
 *
 * Scoped deliberately narrowly to avoid surprising edits: only plain
 * typing (isUserEvent("input.type")) with a single caret, no selection.
 * Paste, multi-cursor edits, and wrapping a selection by typing a start
 * symbol are all left alone for now.
 *
 * Not gated on Live Preview — typing convenience should work in Source
 * Mode too, unlike the fold-collapsing decorations themselves.
 */
export function createAutoPairBehavior(dataStore: PluginDataStore): Extension {
  return EditorState.transactionFilter.of((tr: Transaction) => {
    if (!tr.docChanged) return tr;
    if (!tr.isUserEvent("input.type")) return tr;
    if (!tr.selection || tr.selection.ranges.length !== 1 || !tr.selection.main.empty) return tr;

    const settings = dataStore.getSettings();
    if (!settings.autoPairDelimiters || settings.classes.length === 0) return tr;

    const cursor = tr.selection.main.head;
    const maxStartLen = Math.max(0, ...settings.classes.map((c) => c.startSymbol.length));
    const maxEndLen = Math.max(0, ...settings.classes.map((c) => c.endSymbol.length));
    if (maxStartLen === 0) return tr;

    const precedingText = tr.newDoc.sliceString(Math.max(0, cursor - maxStartLen), cursor);
    const followingText = tr.newDoc.sliceString(cursor, Math.min(tr.newDoc.length, cursor + maxEndLen));

    const endSymbol = computeAutoPairEndSymbol(precedingText, followingText, settings.classes);
    if (!endSymbol) return tr;

    return [
      tr,
      {
        changes: { from: cursor, insert: endSymbol },
        selection: EditorSelection.cursor(cursor),
        userEvent: "input.complete",
      },
    ];
  });
}
