import { EditorView } from "@codemirror/view";
import { MarkdownView, Plugin } from "obsidian";
import { PluginDataStore } from "./data/PluginDataStore";
import { FoldClass } from "./core/types";
import { SettingsTab } from "./settings/SettingsTab";
import { CommandManager } from "./commands/commandManager";
import { createLivePreviewExtension, refreshDecorationsEffect } from "./live-preview";
import { createFoldPostProcessor } from "./reading-view/postProcessor";

export default class InlineFoldPlugin extends Plugin {
  dataStore!: PluginDataStore;
  private commandManager!: CommandManager;

  async onload(): Promise<void> {
    this.dataStore = new PluginDataStore(this);
    await this.dataStore.load();

    this.commandManager = new CommandManager(this, this.dataStore);
    this.commandManager.refresh();

    this.registerEditorExtension(createLivePreviewExtension(this.dataStore, () => this.classesById(), this.app));
    this.registerMarkdownPostProcessor(createFoldPostProcessor(this.dataStore, () => this.classesById(), this.app));

    this.addSettingTab(new SettingsTab(this.app, this, this.dataStore, () => this.onSettingsChanged()));

    // Single source of truth (PluginDataStore) notifies every open Live
    // Preview editor for the affected file — including panes other than
    // the one the toggle happened in — instead of each editor keeping
    // its own copy of what's expanded.
    this.registerEvent(
      this.dataStore.on("expansion-change", (...data: unknown[]) => this.refreshLivePreview(data[0] as string)),
    );

    this.register(() => {
      void this.dataStore.flush();
    });
  }

  async onunload(): Promise<void> {
    await this.dataStore.flush();
  }

  private classesById(): Map<string, FoldClass> {
    return new Map(this.dataStore.getSettings().classes.map((cls) => [cls.id, cls]));
  }

  private onSettingsChanged(): void {
    this.commandManager.refresh();
    this.app.workspace.iterateAllLeaves((leaf) => this.dispatchRefresh(leaf));
  }

  private refreshLivePreview(filePath: string): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView && leaf.view.file?.path === filePath) {
        this.dispatchRefresh(leaf);
      }
    });
  }

  private dispatchRefresh(leaf: { view: unknown }): void {
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return;
    const cm = (view.editor as unknown as { cm?: EditorView }).cm;
    cm?.dispatch({ effects: refreshDecorationsEffect.of(null) });
  }
}
