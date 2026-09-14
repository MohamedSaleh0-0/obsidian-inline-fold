import { FoldClass } from "./types";

export type RenderMode = "inline" | "popover-fold" | "annotation";

type RevealFields = Pick<FoldClass, "contentVisibility" | "revealStyle">;

/**
 * Decides how a fold node should be rendered:
 *  - "annotation": content is always visible; a popover shows `alias`
 *    (the definition) on hover/click. `revealStyle` is ignored.
 *  - "popover-fold": content stays hidden; a popover shows `content`
 *    on hover/click instead of expanding it in place.
 *  - "inline": the classic fold — expands/collapses in place.
 *
 * Pure so the settings UI can reuse the exact same logic for its
 * `visible` predicates instead of duplicating the condition and
 * risking the two drifting apart.
 */
export function determineRenderMode(cls: RevealFields | undefined): RenderMode {
  if (!cls) return "inline";
  if (cls.contentVisibility === "visible") return "annotation";
  if (cls.revealStyle === "popover") return "popover-fold";
  return "inline";
}

/** Whether a class will show its content in a popover at all (either mode). */
export function usesPopover(cls: RevealFields): boolean {
  return determineRenderMode(cls) !== "inline";
}
