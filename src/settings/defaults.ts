import { FoldClass, PluginSettings } from "../core/types";

export const DEFAULT_FLASHCARD_CLASS: FoldClass = {
  id: "default-flashcard",
  name: "Flashcard Answer",
  startSymbol: "[=",
  endSymbol: "=]",
  useRegex: false,
  styleType: "pill",
  triggerText: "?",
  icon: "",
  customTextColor: "var(--text-accent)",
  customBgColor: "var(--background-primary-alt)",
  customBorderColor: "var(--interactive-accent)",
  customBorderStyle: "solid",
  customBorderWidth: "1px",
  customBorderRadius: "6px",
  customPadding: "2px 8px",
  customFontSize: "0.95em",
};

export const DEFAULT_SETTINGS: PluginSettings = {
  interactionMode: "both",
  linkCursorToExpansion: "atomicOnCollapse",
  protectCollapsedBoundaries: true,
  hotkeyExpansionTarget: "line",
  hoverCollapseDelay: 200,
  autoPairDelimiters: true,
  autoCollapseAfterMs: 0,
  classes: [DEFAULT_FLASHCARD_CLASS],
};

export function createBlankFoldClass(index: number): FoldClass {
  return {
    id: `class-${Date.now()}`,
    name: `Class (${index})`,
    startSymbol: "[?",
    endSymbol: "?]",
    useRegex: false,
    styleType: "pill",
    triggerText: "??",
    icon: "",
    customTextColor: "var(--text-normal)",
    customBgColor: "var(--background-modifier-form-field)",
    customBorderColor: "var(--background-modifier-border)",
    customBorderStyle: "solid",
    customBorderWidth: "1px",
    customBorderRadius: "12px",
    customPadding: "2px 6px",
    customFontSize: "inherit",
  };
}
