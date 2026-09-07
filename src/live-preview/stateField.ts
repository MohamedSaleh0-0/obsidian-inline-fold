import { EditorState, Range, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { App, editorInfoField, editorLivePreviewField } from "obsidian";
import { FoldParser } from "../core/parser";
import { assignFoldKeys } from "../core/foldTree";
import { FoldClass, FoldNode, PluginSettings } from "../core/types";
import { FoldRenderContext } from "../render/domBuilder";
import { PluginDataStore } from "../data/PluginDataStore";
import { refreshDecorationsEffect } from "./effects";
import { FoldWidget } from "./widget";

function getFilePath(state: EditorState): string | null {
  return state.field(editorInfoField, false)?.file?.path ?? null;
}

function collectDocNodes(state: EditorState, settings: PluginSettings): FoldNode[] {
  const parser = new FoldParser(settings.classes);
  const startSymbols = settings.classes.map((c) => c.startSymbol).filter((s) => s.length > 0);
  if (startSymbols.length === 0) return [];

  const nodes: FoldNode[] = [];
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (!startSymbols.some((s) => line.text.includes(s))) continue;
    nodes.push(...parser.parseLine(line.text, line.from));
  }
  return nodes;
}

/**
 * A collapsed fold should fall back to showing raw markdown (no
 * decoration at all) whenever the cursor is actively inside or right at
 * its boundary, so the delimiters stay editable. Boundary touches are
 * still allowed through once the fold is already expanded — standing at
 * the edge of visible content isn't "entering" a hidden region the same
 * way it is for a collapsed one.
 */
function selectionTouchesFold(
  state: EditorState,
  node: FoldNode,
  expanded: boolean,
  settings: PluginSettings,
): boolean {
  for (const range of state.selection.ranges) {
    if (range.head > node.from && range.head < node.to) return true;
    if (range.head === node.from || range.head === node.to) {
      if (!settings.protectCollapsedBoundaries || expanded) return true;
    }
    if (settings.linkCursorToExpansion === "alwaysReveal") {
      if (range.from <= node.to && range.to >= node.from) return true;
    }
  }
  return false;
}

function buildDecorations(
  state: EditorState,
  dataStore: PluginDataStore,
  classesById: Map<string, FoldClass>,
  app: App,
): DecorationSet {
  const filePath = getFilePath(state);
  if (filePath === null) return Decoration.none;

  const settings = dataStore.getSettings();
  const rootNodes = collectDocNodes(state, settings);
  if (rootNodes.length === 0) return Decoration.none;

  const foldKeys = assignFoldKeys(rootNodes);
  const ctx: FoldRenderContext = {
    classesById,
    foldKeys,
    settings,
    app,
    sourcePath: filePath,
    isExpanded: (key) => dataStore.isExpanded(filePath, key),
    onToggle: (key) => dataStore.setExpanded(filePath, key, !dataStore.isExpanded(filePath, key)),
  };

  const ranges: Range<Decoration>[] = [];
  for (const node of rootNodes) {
    const key = foldKeys.get(node) as string;
    const expanded = dataStore.isExpanded(filePath, key);
    if (selectionTouchesFold(state, node, expanded, settings)) continue;
    ranges.push(Decoration.replace({ widget: new FoldWidget(node, ctx, expanded) }).range(node.from, node.to));
  }

  return Decoration.set(ranges, true);
}

export function createFoldStateField(
  dataStore: PluginDataStore,
  classesById: () => Map<string, FoldClass>,
  app: App,
): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create(state) {
      if (!state.field(editorLivePreviewField, false)) return Decoration.none;
      return buildDecorations(state, dataStore, classesById(), app);
    },
    update(deco, tr) {
      if (!tr.state.field(editorLivePreviewField, false)) return Decoration.none;

      const forcedRefresh = tr.effects.some((e) => e.is(refreshDecorationsEffect));
      const selectionChanged = !tr.startState.selection.eq(tr.state.selection);

      if (tr.docChanged || forcedRefresh || selectionChanged) {
        return buildDecorations(tr.state, dataStore, classesById(), app);
      }
      return deco.map(tr.changes);
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
