import { App, setIcon } from "obsidian";
import { FoldClass, FoldNode, PluginSettings } from "../core/types";
import { InlineNode, parseInlineMarkdown } from "../core/inlineMarkdown";
import { applyFoldStyle } from "./styleEngine";

export interface FoldRenderContext {
  classesById: Map<string, FoldClass>;
  foldKeys: Map<FoldNode, string>;
  settings: PluginSettings;
  isExpanded: (foldKey: string) => boolean;
  /** Called after the click handler has already applied the optimistic
   *  local DOM update — responsible for persisting + notifying other views. */
  onToggle: (foldKey: string, node: FoldNode) => void;
  /** Needed for wikilink navigation. Omit in contexts that don't render
   *  interactive links (e.g. tests) — wikilinks just render inert then. */
  app?: App;
  sourcePath?: string;
}

/**
 * Renders a span of plain text interleaved with fold capsules for the
 * top-level nodes found in it. Used both for a whole paragraph
 * (Reading view) and, recursively, for the inside of an expanded fold
 * (nested folds) — the same function either way, so nesting "just
 * works" everywhere without special-casing.
 */
export function renderInlineContent(
  container: HTMLElement,
  text: string,
  textOffset: number,
  nodes: FoldNode[],
  ctx: FoldRenderContext,
): void {
  let cursor = 0;
  for (const node of nodes) {
    const relFrom = node.from - textOffset;
    const relTo = node.to - textOffset;
    if (relFrom > cursor) {
      renderInlineMarkdownRun(container, text.substring(cursor, relFrom), ctx);
    }
    container.appendChild(renderFoldNode(node, ctx));
    cursor = relTo;
  }
  if (cursor < text.length) {
    renderInlineMarkdownRun(container, text.substring(cursor), ctx);
  }
}

/**
 * Parses a run of plain text for a small set of inline markdown
 * (bold/italic/code/links/wikilinks — see core/inlineMarkdown.ts) and
 * appends the result. In Live Preview this is where "rich content
 * inside folds" actually comes from, since fold content there is raw,
 * unrendered source text. In Reading view it's usually a safe no-op:
 * by the time our post-processor sees a paragraph's text, Obsidian's
 * own renderer has already consumed any markdown syntax elsewhere in
 * that paragraph and turned it into real elements — there's nothing
 * left in the plain-text content we read back out to re-parse. See the
 * README for the one case that doesn't cover (formatting *inside* a
 * fold's own content when read via Reading view).
 */
function renderInlineMarkdownRun(container: HTMLElement, text: string, ctx: FoldRenderContext): void {
  for (const node of parseInlineMarkdown(text)) {
    container.appendChild(renderInlineMarkdownNode(node, ctx));
  }
}

function renderInlineMarkdownNode(node: InlineNode, ctx: FoldRenderContext): Node {
  switch (node.type) {
    case "text":
      return document.createTextNode(node.value);
    case "bold": {
      const el = createEl("strong");
      for (const child of node.children) el.appendChild(renderInlineMarkdownNode(child, ctx));
      return el;
    }
    case "italic": {
      const el = createEl("em");
      for (const child of node.children) el.appendChild(renderInlineMarkdownNode(child, ctx));
      return el;
    }
    case "code": {
      const el = createEl("code");
      el.textContent = node.value;
      return el;
    }
    case "link": {
      const el = createEl("a", { attr: { href: node.url, target: "_blank", rel: "noopener" } });
      for (const child of node.label) el.appendChild(renderInlineMarkdownNode(child, ctx));
      return el;
    }
    case "wikilink": {
      const el = createEl("a", { cls: "internal-link" });
      el.textContent = node.alias ?? node.target;
      if (ctx.app) {
        const app = ctx.app;
        const sourcePath = ctx.sourcePath ?? "";
        el.addEventListener("click", (evt) => {
          evt.preventDefault();
          evt.stopPropagation();
          void app.workspace.openLinkText(node.target, sourcePath, evt.metaKey || evt.ctrlKey);
        });
      }
      return el;
    }
  }
}

/** Renders a single fold node (and, recursively, any nested folds inside it). */
export function renderFoldNode(node: FoldNode, ctx: FoldRenderContext): HTMLElement {
  const foldClass = ctx.classesById.get(node.classId);
  const key = ctx.foldKeys.get(node) ?? `${node.classId}::${node.content}`;
  const expanded = ctx.isExpanded(key);

  const wrapper = createEl("span");
  const trigger = createEl("span", { cls: "inline-fold-trigger" });
  if (foldClass?.icon) {
    const iconEl = createEl("span", { cls: "inline-fold-icon" });
    setIcon(iconEl, foldClass.icon);
    trigger.appendChild(iconEl);
  }
  const triggerText = node.alias ?? foldClass?.triggerText ?? "?";
  if (triggerText) trigger.appendChild(document.createTextNode(triggerText));

  const content = createEl("span", { cls: "inline-fold-content" });

  if (node.children.length > 0) {
    renderInlineContent(content, node.content, node.contentFrom, node.children, ctx);
  } else {
    renderInlineMarkdownRun(content, node.content, ctx);
  }

  applyFoldStyle(wrapper, foldClass, expanded);
  wrapper.appendChild(trigger);
  wrapper.appendChild(content);
  bindFoldEvents(wrapper, foldClass, ctx, key, node, expanded);

  return wrapper;
}

function bindFoldEvents(
  wrapper: HTMLElement,
  foldClass: FoldClass | undefined,
  ctx: FoldRenderContext,
  key: string,
  node: FoldNode,
  initiallyExpanded: boolean,
): void {
  const mode = ctx.settings.interactionMode;
  let hoverTimer: number | null = null;
  let autoCollapseTimer: number | null = null;
  let expanded = initiallyExpanded;

  const clearAutoCollapseTimer = (): void => {
    if (autoCollapseTimer !== null) {
      window.clearTimeout(autoCollapseTimer);
      autoCollapseTimer = null;
    }
  };

  if (mode === "click" || mode === "both") {
    wrapper.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      expanded = !expanded;
      applyFoldStyle(wrapper, foldClass, expanded);
      ctx.onToggle(key, node);
      clearAutoCollapseTimer();

      // A click-expanded fold can auto-recollapse after a delay — handy
      // for timed self-testing. Hover-reveal already has its own,
      // separate recollapse-on-mouseleave mechanism and isn't affected.
      if (expanded && ctx.settings.autoCollapseAfterMs > 0) {
        autoCollapseTimer = window.setTimeout(() => {
          autoCollapseTimer = null;
          if (!expanded) return; // user (or another timer) already changed it
          expanded = false;
          applyFoldStyle(wrapper, foldClass, expanded);
          ctx.onToggle(key, node);
        }, ctx.settings.autoCollapseAfterMs);
      }
    });
  }

  if (mode === "hover" || mode === "both") {
    wrapper.addEventListener("mouseenter", () => {
      if (hoverTimer !== null) {
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      wrapper.classList.add("is-hover-revealed");
    });
    wrapper.addEventListener("mouseleave", () => {
      const delay = ctx.settings.hoverCollapseDelay;
      const clear = (): void => wrapper.classList.remove("is-hover-revealed");
      if (delay > 0) hoverTimer = window.setTimeout(clear, delay);
      else clear();
    });
  }
}
