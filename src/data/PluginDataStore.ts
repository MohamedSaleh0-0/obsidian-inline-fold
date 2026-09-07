import { Events, Plugin, TAbstractFile, TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import { PluginSettings } from "../core/types";
import { PersistedData } from "./types";

const SAVE_DEBOUNCE_MS = 1500;

/**
 * Owns both settings and per-file fold expansion state, persisted
 * together via Obsidian's plugin data.json.
 *
 * This replaces the old plugin's two separate, module-scoped globals
 * (a Set of raw editor offsets for Live Preview, a Set of content
 * strings for Reading view) that leaked state across every open file
 * in the vault. Expansion state here is:
 *   - scoped per file path,
 *   - the single source of truth for both Live Preview and Reading
 *     view (they both read/write through this store instead of
 *     keeping their own copies), and
 *   - persisted to disk, debounced so rapid toggling doesn't hammer
 *     the filesystem.
 *
 * Emits "settings-change" and "expansion-change" (with the affected
 * file path) so editor extensions and the settings tab can react.
 */
export class PluginDataStore extends Events {
  private data: PersistedData = { settings: DEFAULT_SETTINGS, expansions: {} };
  private saveTimer: number | null = null;

  constructor(private plugin: Plugin) {
    super();
  }

  async load(): Promise<void> {
    const raw = await this.plugin.loadData();
    this.data = normalizePersistedData(raw);

    this.plugin.registerEvent(
      this.plugin.app.vault.on("rename", (file, oldPath) => this.handleRename(file, oldPath)),
    );
    this.plugin.registerEvent(
      this.plugin.app.vault.on("delete", (file) => this.handleDelete(file)),
    );
  }

  getSettings(): PluginSettings {
    return this.data.settings;
  }

  async setSettings(settings: PluginSettings): Promise<void> {
    this.data.settings = settings;
    this.trigger("settings-change", settings);
    await this.persist();
  }

  isExpanded(filePath: string, foldKey: string): boolean {
    return this.data.expansions[filePath]?.includes(foldKey) ?? false;
  }

  setExpanded(filePath: string, foldKey: string, expanded: boolean): void {
    const changed = this.applyExpanded(filePath, foldKey, expanded);
    if (!changed) return;
    this.trigger("expansion-change", filePath);
    this.schedulePersist();
  }

  /**
   * Applies several expansion changes for one file as a single unit —
   * one "expansion-change" event and one debounced persist, instead of
   * one per fold. Used by "expand/collapse all", where firing a full
   * CM6 decoration rebuild per fold would be wasteful on a note with
   * many folds.
   */
  setManyExpanded(filePath: string, foldKeys: string[], expanded: boolean): void {
    let anyChanged = false;
    for (const key of foldKeys) {
      if (this.applyExpanded(filePath, key, expanded)) anyChanged = true;
    }
    if (!anyChanged) return;
    this.trigger("expansion-change", filePath);
    this.schedulePersist();
  }

  private applyExpanded(filePath: string, foldKey: string, expanded: boolean): boolean {
    const current = new Set(this.data.expansions[filePath] ?? []);
    const alreadyMatches = expanded ? current.has(foldKey) : !current.has(foldKey);
    if (alreadyMatches) return false;

    if (expanded) current.add(foldKey);
    else current.delete(foldKey);

    if (current.size > 0) this.data.expansions[filePath] = Array.from(current);
    else delete this.data.expansions[filePath];

    return true;
  }

  /** Immediately flushes any pending debounced write. Call on unload. */
  async flush(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.persist();
  }

  private handleRename(file: TAbstractFile, oldPath: string): void {
    if (!(file instanceof TFile)) return;
    if (this.data.expansions[oldPath]) {
      this.data.expansions[file.path] = this.data.expansions[oldPath];
      delete this.data.expansions[oldPath];
      this.schedulePersist();
    }
  }

  private handleDelete(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (this.data.expansions[file.path]) {
      delete this.data.expansions[file.path];
      this.schedulePersist();
    }
  }

  private schedulePersist(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void this.persist();
    }, SAVE_DEBOUNCE_MS);
  }

  private async persist(): Promise<void> {
    this.saveTimer = null;
    await this.plugin.saveData(this.data);
  }
}

/**
 * Accepts either the new `{ settings, expansions }` shape or a v1
 * data.json (a flat settings object with no `expansions` key at all)
 * so upgrading doesn't silently reset a user's configured fold classes.
 */
function normalizePersistedData(raw: Record<string, unknown> | null): PersistedData {
  if (raw && !("settings" in raw) && Array.isArray((raw as { classes?: unknown }).classes)) {
    return {
      settings: backfillClassFields(Object.assign({}, DEFAULT_SETTINGS, raw) as PluginSettings),
      expansions: {},
    };
  }
  const typed = raw as Partial<PersistedData> | null;
  return {
    settings: backfillClassFields(Object.assign({}, DEFAULT_SETTINGS, typed?.settings)),
    expansions: typed?.expansions ?? {},
  };
}

/**
 * Fills in fields added to FoldClass after some classes were already
 * saved (`icon`, `useRegex`) so older data.json files don't leave a
 * literal `undefined` sitting in a settings field.
 */
function backfillClassFields(settings: PluginSettings): PluginSettings {
  return {
    ...settings,
    classes: settings.classes.map((cls) => ({
      ...cls,
      icon: cls.icon ?? "",
      useRegex: cls.useRegex ?? false,
    })),
  };
}
