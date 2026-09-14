import { App, PluginSettingTab, SettingDefinitionItem, SettingDefinitionPage } from "obsidian";
import type InlineFoldPlugin from "../main";
import { PluginDataStore } from "../data/PluginDataStore";
import { createBlankFoldClass } from "./defaults";
import { FoldClass } from "../core/types";
import { findDelimiterCollisions, findInvalidRegexClasses } from "../core/delimiterValidation";
import { usesPopover } from "../core/revealMode";

/** Namespaces a per-class field as a control key: "class.<id>.<field>". */
const CLASS_KEY_PREFIX = "class.";

/**
 * Rebuilt on Obsidian 1.13's declarative settings API (getSettingDefinitions)
 * instead of the old imperative display()/containerEl approach.
 *
 * This isn't just a style preference: under 1.13's new Settings window,
 * an imperative tab that calls containerEl.empty() + rebuilds itself (the
 * old redisplayPreservingScroll() pattern) rendered visibly broken —
 * rows packed into narrow flex columns instead of stacking. The
 * declarative API sidesteps the whole class of bug: Obsidian owns the
 * container and layout, and this only ever describes *what* the settings
 * are. It also gets us real drill-in pages for fold classes for free,
 * instead of the flat card-per-class layout the old tab used.
 *
 * Settings live in PluginDataStore, not the conventional
 * `this.plugin.settings`, so getControlValue/setControlValue are
 * overridden to read/write through it. Per-class fields are addressed
 * by a synthetic "class.<id>.<field>" key rather than an array index,
 * so a control stays bound to the right class across reorders/deletes.
 */
export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: InlineFoldPlugin,
    private dataStore: PluginDataStore,
    private onChanged: () => void,
  ) {
    super(app, plugin);
  }

  getControlValue(key: string): unknown {
    const settings = this.dataStore.getSettings();
    if (key.startsWith(CLASS_KEY_PREFIX)) {
      const [, classId, field] = key.split(".");
      const cls = settings.classes.find((c) => c.id === classId);
      return cls ? (cls as unknown as Record<string, unknown>)[field] : undefined;
    }
    return (settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.dataStore.getSettings();
    if (key.startsWith(CLASS_KEY_PREFIX)) {
      const [, classId, field] = key.split(".");
      const cls = settings.classes.find((c) => c.id === classId);
      if (cls) (cls as unknown as Record<string, unknown>)[field] = value;
    } else {
      (settings as unknown as Record<string, unknown>)[key] = value;
    }
    await this.dataStore.setSettings(settings);
    this.onChanged();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.dataStore.getSettings();

    return [
      // General settings get no heading — this is the "general" section,
      // per Obsidian's own settings style guide.
      {
        name: "Interaction mode",
        desc: "How folds expand: click, hover, or both.",
        control: {
          type: "dropdown",
          key: "interactionMode",
          options: { click: "Click only", hover: "Hover only", both: "Both" },
        },
      },
      {
        name: "Cursor behavior over collapsed folds",
        desc: "Whether the caret jumps over a collapsed fold or reveals its raw markdown as it approaches.",
        control: {
          type: "dropdown",
          key: "linkCursorToExpansion",
          options: { atomicOnCollapse: "Jump over (atomic)", alwaysReveal: "Always reveal on proximity" },
        },
      },
      {
        name: "Protect collapsed boundaries",
        desc: "Keep the caret from exposing raw markdown at a fold's edges unless it's already expanded.",
        control: { type: "toggle", key: "protectCollapsedBoundaries" },
      },
      {
        name: "Hotkey expansion target",
        desc: 'What "Toggle expansion/collapse" affects: every fold on the line, or the closest one to the cursor.',
        control: {
          type: "dropdown",
          key: "hotkeyExpansionTarget",
          options: { line: "Whole line", closest: "Closest fold" },
        },
      },
      {
        name: "Hover collapse delay",
        desc: "Grace period (ms) before a hover-revealed fold collapses again after the pointer leaves.",
        control: { type: "slider", key: "hoverCollapseDelay", min: 0, max: 1000, step: 50 },
      },
      {
        name: "Auto-pair delimiters",
        desc: "Typing a class's start symbol automatically inserts its end symbol, cursor left in between.",
        control: { type: "toggle", key: "autoPairDelimiters" },
      },
      {
        name: "Auto-collapse after (ms)",
        desc: "A fold expanded by clicking automatically collapses again after this delay. 0 disables it.",
        control: { type: "number", key: "autoCollapseAfterMs", min: 0, step: 50 },
      },

      // Fold classes: a reorderable list of navigable sub-pages, one per class.
      {
        type: "list",
        heading: "Fold classes",
        emptyState: "No fold classes yet — add one to start folding text.",
        addItem: {
          name: "Add class",
          action: () => this.addClass(),
        },
        onReorder: (oldIndex, newIndex) => this.reorderClasses(oldIndex, newIndex),
        onDelete: (index) => this.deleteClass(index),
        items: settings.classes.map((cls) => this.buildClassPage(cls, settings.classes)),
      },
    ];
  }

  private buildClassPage(cls: FoldClass, allClasses: FoldClass[]): SettingDefinitionPage {
    const collisions = findDelimiterCollisions(allClasses).filter((c) => c.classId === cls.id);
    const regexIssues = findInvalidRegexClasses(allClasses).filter((i) => i.classId === cls.id);
    const prefix = CLASS_KEY_PREFIX + cls.id + ".";

    const warningRows: SettingDefinitionItem[] = [
      ...collisions.map((c) => ({
        name:
          c.reason === "duplicate"
            ? `⚠ Start symbol is identical to "${c.shadowedByClassName}"'s`
            : `⚠ Start symbol starts with "${c.shadowedByClassName}"'s`,
        desc: "That earlier class matches first, so this class's fold can never trigger. Reorder the list above or change the delimiter.",
      })),
      ...regexIssues.map((issue) => ({
        name: `✗ ${issue.field === "start" ? "Start" : "End"} symbol isn't a valid regex`,
        desc: issue.message,
      })),
    ];

    return {
      type: "page",
      name: cls.name || "Unnamed class",
      desc: `${cls.startSymbol || "…"} … ${cls.endSymbol || "…"}`,
      status: collisions.length > 0 || regexIssues.length > 0 ? "warning" : null,
      items: [
        ...warningRows,
        { name: "Name", control: { type: "text", key: prefix + "name", defaultValue: "Unnamed class" } },
        {
          name: "Use regex delimiters",
          desc: "Interpret the start/end symbols below as regular expressions instead of literal text. Auto-pair and the wrap-selection command aren't available for regex classes.",
          control: { type: "toggle", key: prefix + "useRegex" },
        },
        {
          name: "Start symbol",
          desc: "The opening delimiter — literal text, or a pattern if regex delimiters are on above.",
          control: { type: "text", key: prefix + "startSymbol", defaultValue: "[=" },
        },
        {
          name: "End symbol",
          desc: "The closing delimiter — literal text, or a pattern if regex delimiters are on above.",
          control: { type: "text", key: prefix + "endSymbol", defaultValue: "=]" },
        },
        {
          name: "Content visibility",
          desc: "Hidden content is a fold. Always-visible content is an annotation: the text renders normally, and extra info shows on hover/click.",
          control: {
            type: "dropdown",
            key: prefix + "contentVisibility",
            options: { hidden: "Hidden (fold)", visible: "Always visible (annotation)" },
          },
        },
        {
          name: "How this works",
          desc: 'Write `word|definition` inside the delimiters — e.g. `[=mitochondria|the powerhouse of the cell=]` shows "mitochondria" plainly in the text and reveals the definition on hover/click.',
          visible: () => cls.contentVisibility === "visible",
        },
        {
          name: "Reveal style",
          desc: "Expand the content in place, or leave it hidden and show it in a floating card on hover/click instead.",
          visible: () => cls.contentVisibility === "hidden",
          control: {
            type: "dropdown",
            key: prefix + "revealStyle",
            options: { inline: "Expand in place", popover: "Floating card (popover)" },
          },
        },
        {
          name: "Trigger text",
          visible: () => cls.contentVisibility === "hidden",
          control: { type: "text", key: prefix + "triggerText", defaultValue: "?" },
        },
        {
          name: "Icon (optional)",
          desc: "A Lucide icon id (browse names at lucide.dev) shown before the trigger text.",
          visible: () => cls.contentVisibility === "hidden",
          control: { type: "text", key: prefix + "icon", placeholder: "e.g. sparkles" },
        },
        {
          name: "Style",
          visible: () => cls.contentVisibility === "hidden",
          control: {
            type: "dropdown",
            key: prefix + "styleType",
            options: {
              ghost: "Ghost",
              pill: "Pill",
              bracket: "Bracket",
              underline: "Underline",
              badge: "Badge",
              custom: "Custom",
            },
          },
        },
        {
          name: "Popover content",
          desc: "Simple stays inline-friendly (bold/italic/code/links/wikilinks). Rich renders full Markdown — headings, lists, images, embeds — since a popover isn't constrained to a single line.",
          visible: () => usesPopover(cls),
          control: {
            type: "dropdown",
            key: prefix + "popoverContentMode",
            options: { simple: "Simple", rich: "Rich (full Markdown)" },
          },
        },
        {
          type: "group",
          heading: "Custom style",
          visible: () => cls.contentVisibility === "hidden" && cls.styleType === "custom",
          items: [
            { name: "Text color", control: { type: "text", key: prefix + "customTextColor", defaultValue: "inherit" } },
            {
              name: "Background color",
              control: { type: "text", key: prefix + "customBgColor", defaultValue: "transparent" },
            },
            {
              name: "Border style",
              control: {
                type: "dropdown",
                key: prefix + "customBorderStyle",
                options: { none: "None", solid: "Solid", dashed: "Dashed", dotted: "Dotted" },
              },
            },
            {
              name: "Border color",
              control: { type: "text", key: prefix + "customBorderColor", defaultValue: "transparent" },
            },
            { name: "Border width", control: { type: "text", key: prefix + "customBorderWidth", defaultValue: "1px" } },
            {
              name: "Border radius",
              control: { type: "text", key: prefix + "customBorderRadius", defaultValue: "0px" },
            },
            { name: "Padding", control: { type: "text", key: prefix + "customPadding", defaultValue: "0px" } },
            { name: "Font size", control: { type: "text", key: prefix + "customFontSize", defaultValue: "inherit" } },
          ],
        },
      ],
    };
  }

  /**
   * These three mutate the in-memory settings object (already the live
   * reference PluginDataStore holds) and call update() immediately, so
   * the list visibly reflects the change right away — persisting to
   * disk happens in the background rather than blocking the UI update.
   */
  private addClass(): void {
    const settings = this.dataStore.getSettings();
    settings.classes.push(createBlankFoldClass(settings.classes.length + 1));
    this.update();
    void this.dataStore.setSettings(settings).then(() => this.onChanged());
  }

  private reorderClasses(oldIndex: number, newIndex: number): void {
    const settings = this.dataStore.getSettings();
    const [moved] = settings.classes.splice(oldIndex, 1);
    settings.classes.splice(newIndex, 0, moved);
    this.update();
    void this.dataStore.setSettings(settings).then(() => this.onChanged());
  }

  private deleteClass(index: number): void {
    const settings = this.dataStore.getSettings();
    settings.classes.splice(index, 1);
    this.update();
    void this.dataStore.setSettings(settings).then(() => this.onChanged());
  }
}
