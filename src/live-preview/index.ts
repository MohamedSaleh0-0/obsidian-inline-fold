import { Extension, Prec } from "@codemirror/state";
import { App } from "obsidian";
import { FoldClass } from "../core/types";
import { PluginDataStore } from "../data/PluginDataStore";
import { createFoldStateField } from "./stateField";
import { createCursorBehavior } from "./cursorBehavior";
import { createAutoPairBehavior } from "./autoPair";

export function createLivePreviewExtension(
  dataStore: PluginDataStore,
  classesById: () => Map<string, FoldClass>,
  app: App,
): Extension {
  return [
    Prec.highest(createFoldStateField(dataStore, classesById, app)),
    createCursorBehavior(dataStore),
    createAutoPairBehavior(dataStore),
  ];
}

export { refreshDecorationsEffect } from "./effects";
