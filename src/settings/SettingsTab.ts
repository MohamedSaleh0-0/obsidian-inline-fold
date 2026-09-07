import { App, PluginSettingTab, Setting } from "obsidian";
import type InlineFoldPlugin from "../main";
import { PluginDataStore } from "../data/PluginDataStore";
import { createBlankFoldClass } from "./defaults";
import { FoldClass } from "../core/types";
import { findDelimiterCollisions, findInvalidRegexClasses } from "../core/delimiterValidation";

export class SettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: InlineFoldPlugin,
    private dataStore: PluginDataStore,
    private onChanged: () => void,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Inline Fold" });

    this.renderGlobalSettings(containerEl);

    containerEl.createEl("hr");
    const header = containerEl.createDiv({ cls: "inline-fold-classes-header" });
    header.createEl("h3", { text: "Fold classes" });
    new Setting(header).addButton((btn) =>
      btn
        .setButtonText("+ Add class")
        .setCta()
        .onClick(async () => {
          const settings = this.dataStore.getSettings();
          settings.classes.push(createBlankFoldClass(settings.classes.length + 1));
          await this.persist(settings);
          this.redisplayPreservingScroll();
        }),
    );

    const settings = this.dataStore.getSettings();
    const collisions = findDelimiterCollisions(settings.classes);
    const regexIssues = findInvalidRegexClasses(settings.classes);
    settings.classes.forEach((cls, index) => this.renderClassCard(containerEl, cls, index, collisions, regexIssues));
  }

  /**
   * Re-renders the whole tab (needed because a few controls change what
   * other rows should show — e.g. toggling regex mode changes the
   * start/end symbol descriptions, picking "Custom" style reveals a
   * whole extra panel). The plain `this.display()` this wraps calls
   * `containerEl.empty()`, which collapses the container to zero height
   * for a moment; without restoring scrollTop afterward, that snaps the
   * whole settings tab back to the top on every one of these changes.
   */
  private redisplayPreservingScroll(): void {
    const scrollTop = this.containerEl.scrollTop;
    this.display();
    this.containerEl.scrollTop = scrollTop;
  }

  private renderGlobalSettings(containerEl: HTMLElement): void {
    const settings = this.dataStore.getSettings();

    new Setting(containerEl)
      .setName("Interaction mode")
      .setDesc("How folds expand: click, hover, or both.")
      .addDropdown((dd) =>
        dd
          .addOption("click", "Click only")
          .addOption("hover", "Hover only")
          .addOption("both", "Both")
          .setValue(settings.interactionMode)
          .onChange(async (value) => {
            settings.interactionMode = value as typeof settings.interactionMode;
            await this.persist(settings);
          }),
      );

    new Setting(containerEl)
      .setName("Cursor behavior over collapsed folds")
      .setDesc("Whether the caret jumps over a collapsed fold or reveals its raw markdown as it approaches.")
      .addDropdown((dd) =>
        dd
          .addOption("atomicOnCollapse", "Jump over (atomic)")
          .addOption("alwaysReveal", "Always reveal on proximity")
          .setValue(settings.linkCursorToExpansion)
          .onChange(async (value) => {
            settings.linkCursorToExpansion = value as typeof settings.linkCursorToExpansion;
            await this.persist(settings);
          }),
      );

    new Setting(containerEl)
      .setName("Protect collapsed boundaries")
      .setDesc("Keep the caret from exposing raw markdown at a fold's edges unless it's already expanded.")
      .addToggle((toggle) =>
        toggle.setValue(settings.protectCollapsedBoundaries).onChange(async (value) => {
          settings.protectCollapsedBoundaries = value;
          await this.persist(settings);
        }),
      );

    new Setting(containerEl)
      .setName("Hotkey expansion target")
      .setDesc('What "Toggle expansion/collapse" affects: every fold on the line, or the closest one to the cursor.')
      .addDropdown((dd) =>
        dd
          .addOption("line", "Whole line")
          .addOption("closest", "Closest fold")
          .setValue(settings.hotkeyExpansionTarget)
          .onChange(async (value) => {
            settings.hotkeyExpansionTarget = value as typeof settings.hotkeyExpansionTarget;
            await this.persist(settings);
          }),
      );

    new Setting(containerEl)
      .setName("Hover collapse delay (ms)")
      .setDesc("Grace period before a hover-revealed fold collapses again after the pointer leaves.")
      .addSlider((slider) =>
        slider
          .setLimits(0, 1000, 50)
          .setValue(settings.hoverCollapseDelay)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.hoverCollapseDelay = value;
            await this.persist(settings);
          }),
      );

    new Setting(containerEl)
      .setName("Auto-pair delimiters")
      .setDesc("Typing a class's start symbol automatically inserts its end symbol, cursor left in between.")
      .addToggle((toggle) =>
        toggle.setValue(settings.autoPairDelimiters).onChange(async (value) => {
          settings.autoPairDelimiters = value;
          await this.persist(settings);
        }),
      );

    new Setting(containerEl)
      .setName("Auto-collapse after (ms)")
      .setDesc(
        "A fold expanded by clicking automatically collapses again after this many milliseconds — useful for timed self-testing. 0 disables it. Doesn't affect hover-reveal, which already has its own delay above.",
      )
      .addText((text) =>
        text.setValue(String(settings.autoCollapseAfterMs)).onChange(async (value) => {
          const parsed = Number(value);
          settings.autoCollapseAfterMs = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
          await this.persist(settings);
        }),
      );
  }

  private renderClassCard(
    containerEl: HTMLElement,
    cls: FoldClass,
    index: number,
    collisions: ReturnType<typeof findDelimiterCollisions>,
    regexIssues: ReturnType<typeof findInvalidRegexClasses>,
  ): void {
    const settings = this.dataStore.getSettings();
    const card = containerEl.createDiv({ cls: "inline-fold-class-card" });

    const header = card.createDiv({ cls: "inline-fold-class-card-header" });
    header.createEl("h4", { text: cls.name });
    const headerButtons = new Setting(header);
    if (index > 0) {
      headerButtons.addButton((btn) =>
        btn
          .setIcon("arrow-up")
          .setTooltip("Move up")
          .onClick(async () => {
            [settings.classes[index - 1], settings.classes[index]] = [settings.classes[index], settings.classes[index - 1]];
            await this.persist(settings);
            this.redisplayPreservingScroll();
          }),
      );
    }
    if (index < settings.classes.length - 1) {
      headerButtons.addButton((btn) =>
        btn
          .setIcon("arrow-down")
          .setTooltip("Move down")
          .onClick(async () => {
            [settings.classes[index], settings.classes[index + 1]] = [settings.classes[index + 1], settings.classes[index]];
            await this.persist(settings);
            this.redisplayPreservingScroll();
          }),
      );
    }
    if (settings.classes.length > 1) {
      headerButtons.addButton((btn) =>
        btn
          .setButtonText("Delete")
          .setWarning()
          .onClick(async () => {
            settings.classes.splice(index, 1);
            await this.persist(settings);
            this.redisplayPreservingScroll();
          }),
      );
    }

    const ownCollisions = collisions.filter((c) => c.classId === cls.id);
    if (ownCollisions.length > 0) {
      const warning = card.createDiv({ cls: "inline-fold-collision-warning" });
      warning.style.color = "var(--text-warning)";
      warning.style.fontSize = "0.85em";
      warning.style.marginBottom = "8px";
      for (const collision of ownCollisions) {
        const reasonText =
          collision.reason === "duplicate"
            ? `identical to "${collision.shadowedByClassName}"'s start symbol`
            : `starts with "${collision.shadowedByClassName}"'s start symbol`;
        warning.createDiv({
          text: `⚠ Start symbol is ${reasonText}, which appears earlier in the list — this class's fold will never trigger. Reorder or change the delimiter.`,
        });
      }
    }

    const ownRegexIssues = regexIssues.filter((issue) => issue.classId === cls.id);
    if (ownRegexIssues.length > 0) {
      const error = card.createDiv({ cls: "inline-fold-regex-error" });
      error.style.color = "var(--text-error)";
      error.style.fontSize = "0.85em";
      error.style.marginBottom = "8px";
      for (const issue of ownRegexIssues) {
        error.createDiv({ text: `✗ ${issue.field === "start" ? "Start" : "End"} symbol isn't a valid regex: ${issue.message}` });
      }
    }

    new Setting(card).setName("Name").addText((text) =>
      text.setValue(cls.name).onChange(async (value) => {
        cls.name = value || "Unnamed class";
        await this.persist(settings);
      }),
    );

    new Setting(card)
      .setName("Use regex delimiters")
      .setDesc(
        "Interpret the start/end symbols below as regular expressions instead of literal text. Auto-pair and the wrap-selection command aren't available for regex classes.",
      )
      .addToggle((toggle) =>
        toggle.setValue(cls.useRegex).onChange(async (value) => {
          cls.useRegex = value;
          await this.persist(settings);
          this.redisplayPreservingScroll();
        }),
      );

    new Setting(card)
      .setName("Start symbol")
      .setDesc(cls.useRegex ? "Regular expression matching the opening delimiter." : "The literal opening delimiter.")
      .addText((text) =>
        text.setValue(cls.startSymbol).onChange(async (value) => {
          cls.startSymbol = value || "[=";
          await this.persist(settings);
        }),
      );

    new Setting(card)
      .setName("End symbol")
      .setDesc(cls.useRegex ? "Regular expression matching the closing delimiter." : "The literal closing delimiter.")
      .addText((text) =>
        text.setValue(cls.endSymbol).onChange(async (value) => {
          cls.endSymbol = value || "=]";
          await this.persist(settings);
        }),
      );

    new Setting(card).setName("Trigger text").addText((text) =>
      text.setValue(cls.triggerText).onChange(async (value) => {
        cls.triggerText = value || "..";
        await this.persist(settings);
      }),
    );

    new Setting(card)
      .setName("Icon (optional)")
      .setDesc("A Lucide icon id (browse names at lucide.dev) shown before the trigger text.")
      .addText((text) =>
        text
          .setPlaceholder("e.g. sparkles")
          .setValue(cls.icon)
          .onChange(async (value) => {
            cls.icon = value;
            await this.persist(settings);
          }),
      );

    new Setting(card).setName("Style").addDropdown((dd) =>
      dd
        .addOption("ghost", "Ghost")
        .addOption("pill", "Pill")
        .addOption("bracket", "Bracket")
        .addOption("underline", "Underline")
        .addOption("badge", "Badge")
        .addOption("custom", "Custom")
        .setValue(cls.styleType)
        .onChange(async (value) => {
          cls.styleType = value as typeof cls.styleType;
          await this.persist(settings);
          this.redisplayPreservingScroll();
        }),
    );

    if (cls.styleType === "custom") {
      const panel = card.createDiv({ cls: "inline-fold-custom-style-panel" });
      this.renderCustomStyleFields(panel, cls, settings);
    }
  }

  private renderCustomStyleFields(
    panel: HTMLElement,
    cls: FoldClass,
    settings: ReturnType<PluginDataStore["getSettings"]>,
  ): void {
    const field = (
      name: string,
      get: () => string,
      set: (value: string) => void,
    ): void => {
      new Setting(panel).setName(name).addText((text) =>
        text.setValue(get()).onChange(async (value) => {
          set(value);
          await this.persist(settings);
        }),
      );
    };

    // Text field + a color-picker swatch as a quick-pick convenience.
    // The text field stays the source of truth and keeps accepting
    // anything CSS accepts — including theme variables like
    // "var(--text-accent)", which is what the default class uses so it
    // adapts to the user's Obsidian theme. The swatch can only write
    // plain hex values, so it's an add-on, not a replacement: picking a
    // color overwrites the text field, but typing a variable into the
    // text field isn't reflected back onto the swatch.
    const colorField = (name: string, get: () => string, set: (value: string) => void): void => {
      const setting = new Setting(panel).setName(name);
      setting.addText((text) =>
        text.setValue(get()).onChange(async (value) => {
          set(value);
          await this.persist(settings);
        }),
      );
      const current = get();
      const swatchValue = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(current) ? current : "#000000";
      setting.addColorPicker((picker) =>
        picker.setValue(swatchValue).onChange(async (value) => {
          set(value);
          await this.persist(settings);
          this.redisplayPreservingScroll();
        }),
      );
    };

    colorField("Text color", () => cls.customTextColor, (v) => (cls.customTextColor = v || "inherit"));
    colorField("Background color", () => cls.customBgColor, (v) => (cls.customBgColor = v || "transparent"));
    new Setting(panel).setName("Border style").addDropdown((dd) =>
      dd
        .addOption("none", "None")
        .addOption("solid", "Solid")
        .addOption("dashed", "Dashed")
        .addOption("dotted", "Dotted")
        .setValue(cls.customBorderStyle)
        .onChange(async (value) => {
          cls.customBorderStyle = value as typeof cls.customBorderStyle;
          await this.persist(settings);
        }),
    );
    colorField("Border color", () => cls.customBorderColor, (v) => (cls.customBorderColor = v || "transparent"));
    field("Border width", () => cls.customBorderWidth, (v) => (cls.customBorderWidth = v || "1px"));
    field("Border radius", () => cls.customBorderRadius, (v) => (cls.customBorderRadius = v || "0px"));
    field("Padding", () => cls.customPadding, (v) => (cls.customPadding = v || "0px"));
    field("Font size", () => cls.customFontSize, (v) => (cls.customFontSize = v || "inherit"));
  }

  private async persist(settings: ReturnType<PluginDataStore["getSettings"]>): Promise<void> {
    await this.dataStore.setSettings(settings);
    this.onChanged();
  }
}
