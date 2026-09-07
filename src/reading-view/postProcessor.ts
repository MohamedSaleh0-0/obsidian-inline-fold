import { App, MarkdownPostProcessor, MarkdownPostProcessorContext } from "obsidian";
import { FoldParser } from "../core/parser";
import { assignFoldKeys } from "../core/foldTree";
import { FoldClass, FoldNode } from "../core/types";
import { PluginDataStore } from "../data/PluginDataStore";
import { FoldRenderContext, renderInlineContent } from "../render/domBuilder";

/**
 * Reading view has no persistent editor state to hang decorations off
 * of — it just re-renders HTML from scratch. So this reads/writes
 * expansion state through the same PluginDataStore that Live Preview
 * uses, scoped by ctx.sourcePath (which the old plugin's post-processor
 * received but never used, leaving expansion state keyed by raw content
 * text — shared across every note in the vault that happened to contain
 * identical text).
 *
 * Known limitation: this reads each candidate element's `.innerText`
 * (flattened plain text), which is what lets it detect a fold
 * regardless of what markdown might be inside it — but it also means
 * any rich formatting already applied by Obsidian's own renderer,
 * anywhere in that same element, gets discarded when the element is
 * rebuilt. A version that walks individual text nodes instead would
 * preserve that surrounding formatting, but breaks detecting a fold
 * whose own content contains further markdown — Obsidian's renderer
 * splits the fold's start/end delimiters into two separate, disjoint
 * text nodes the moment it renders something like `**bold**` between
 * them, so a single text node never contains the whole fold to parse.
 * Neither option is strictly better, and this one fails more gracefully
 * (a folded capsule with plain content, vs. a fold not rendering at
 * all), so it's the one kept for now — see the README.
 */
export function createFoldPostProcessor(
  dataStore: PluginDataStore,
  classesById: () => Map<string, FoldClass>,
  app: App,
): MarkdownPostProcessor {
  return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    const settings = dataStore.getSettings();
    const startSymbols = settings.classes.map((c) => c.startSymbol).filter((s) => s.length > 0);
    if (startSymbols.length === 0) return;

    const parser = new FoldParser(settings.classes);
    const filePath = ctx.sourcePath;

    // Parse every candidate element in this post-processor call up front
    // and assign keys across all of them together, THEN render. Doing it
    // per-element (as the old plugin effectively did, just with a
    // different bug) would let two identical-content folds in different
    // paragraphs collide on the same un-disambiguated key. This still
    // isn't whole-document-perfect for very long notes that Reading view
    // renders in more than one post-processor call, but it covers the
    // realistic case (duplicate content within the same rendered chunk)
    // without an async whole-file read on every render.
    const targets: { el: HTMLElement; text: string; nodes: FoldNode[] }[] = [];
    el.querySelectorAll("p, li, span, td, th").forEach((raw) => {
      const target = raw as HTMLElement;
      const text = target.innerText;
      if (!text || !startSymbols.some((s) => text.includes(s))) return;
      const nodes = parser.parseLine(text, 0);
      if (nodes.length > 0) targets.push({ el: target, text, nodes });
    });
    if (targets.length === 0) return;

    const foldKeys = assignFoldKeys(targets.flatMap((t) => t.nodes));

    for (const { el: target, text, nodes } of targets) {
      const renderCtx: FoldRenderContext = {
        classesById: classesById(),
        foldKeys,
        settings,
        app,
        sourcePath: filePath,
        isExpanded: (key) => dataStore.isExpanded(filePath, key),
        onToggle: (key) => dataStore.setExpanded(filePath, key, !dataStore.isExpanded(filePath, key)),
      };
      target.empty();
      renderInlineContent(target, text, 0, nodes, renderCtx);
    }
  };
}
