export type FoldStyleType = "ghost" | "pill" | "bracket" | "underline" | "badge" | "custom";
export type InteractionMode = "click" | "hover" | "both";
export type CursorLinkMode = "atomicOnCollapse" | "alwaysReveal";
export type HotkeyTarget = "line" | "closest";
export type BorderStyle = "none" | "solid" | "dashed" | "dotted";
/** Whether a class's content starts out hidden (a fold) or is always shown (an annotation). */
export type ContentVisibility = "hidden" | "visible";
/** For hidden content only: expand in place, or stay hidden and show a floating card on hover/click. */
export type RevealStyle = "inline" | "popover";
/** What a popover's body is rendered with. */
export type PopoverContentMode = "simple" | "rich";

/**
 * A single fold "type": a delimiter pair plus how it should look.
 *
 * Kept as one flat shape (rather than a styleType-discriminated union)
 * on purpose: it keeps v1 data.json files loadable without a migration
 * step, and lets the settings UI pre-fill custom-style fields even
 * before a class is switched to styleType "custom". Only styleEngine
 * needs to care about which fields apply for a given styleType.
 */
export interface FoldClass {
  id: string;
  name: string;
  startSymbol: string;
  endSymbol: string;
  /** Interpret startSymbol/endSymbol as regexes instead of literal text. */
  useRegex: boolean;
  styleType: FoldStyleType;
  triggerText: string;
  /** Lucide icon id (see lucide.dev), shown before the trigger text. Empty = no icon. */
  icon: string;
  customTextColor: string;
  customBgColor: string;
  customBorderColor: string;
  customBorderStyle: BorderStyle;
  customBorderWidth: string;
  customBorderRadius: string;
  customPadding: string;
  customFontSize: string;
  /**
   * "hidden" (default) is the classic fold: content is hidden until
   * revealed. "visible" turns the class into an inline annotation —
   * `content` renders as normal, always-visible text, and `alias` (the
   * part after `|`) becomes the popover shown on hover, e.g.
   * `[=mitochondria|the powerhouse of the cell=]` renders the word
   * plainly and shows the definition on hover.
   */
  contentVisibility: ContentVisibility;
  /** Only meaningful when contentVisibility is "hidden". Ignored (always popover) for "visible". */
  revealStyle: RevealStyle;
  /** Only meaningful when a popover is actually shown (see core/revealMode.ts). */
  popoverContentMode: PopoverContentMode;
}

export interface PluginSettings {
  interactionMode: InteractionMode;
  linkCursorToExpansion: CursorLinkMode;
  protectCollapsedBoundaries: boolean;
  hotkeyExpansionTarget: HotkeyTarget;
  hoverCollapseDelay: number;
  autoPairDelimiters: boolean;
  /** A click-expanded fold re-collapses after this many ms. 0 disables it. */
  autoCollapseAfterMs: number;
  classes: FoldClass[];
}

/**
 * A parsed fold instance found in a document. Positions are absolute
 * document offsets. `children` holds folds nested inside this one's
 * content — a real tree, not a flattened/discarded list.
 */
export interface FoldNode {
  from: number;
  to: number;
  /**
   * Absolute offset where raw `content` begins — right after the
   * matched start delimiter. Not necessarily `from + startSymbol.length`:
   * for a regex-based class the actual matched text can be longer or
   * shorter than the pattern source string, so this is recorded
   * directly by the parser rather than recomputed from startSymbol.
   */
  contentFrom: number;
  content: string;
  alias?: string;
  classId: string;
  children: FoldNode[];
}
