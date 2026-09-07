import { PluginSettings } from "../core/types";

export interface PersistedData {
  settings: PluginSettings;
  /** filePath -> array of expanded fold keys (see core/foldTree.ts) */
  expansions: Record<string, string[]>;
}
