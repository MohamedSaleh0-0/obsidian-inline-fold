import { FoldClass } from "../core/types";

const CUSTOM_PROPERTY_MAP: Record<string, keyof FoldClass> = {
  "--fold-text-color": "customTextColor",
  "--fold-bg-color": "customBgColor",
  "--fold-border-color": "customBorderColor",
  "--fold-border-style": "customBorderStyle",
  "--fold-border-width": "customBorderWidth",
  "--fold-border-radius": "customBorderRadius",
  "--fold-padding": "customPadding",
  "--fold-font-size": "customFontSize",
};

/**
 * Applies visual state to an already-built capsule's three elements.
 *
 * This is the ONE place styling logic lives. The old plugin had this
 * exact ghost/pill/bracket/custom branching duplicated near-verbatim in
 * both the CM6 widget and the Reading view post-processor; every future
 * theme or bugfix had to be made twice. Preset themes (ghost/pill/
 * bracket) are plain CSS classes in styles.css — the old `styles.css`
 * was actually dead code, since nothing ever set the
 * `data-inline-capsule-style` body attribute it relied on, and it also
 * couldn't have supported two different styleTypes on screen at once.
 * Only "custom" needs inline styling, since its colors are arbitrary
 * per-class user input — and even then it's expressed as CSS custom
 * properties rather than raw inline styles, so styles.css stays the
 * single source of truth for what each property does.
 */
export function applyFoldStyle(
  wrapper: HTMLElement,
  foldClass: FoldClass | undefined,
  expanded: boolean,
): void {
  const styleType = foldClass?.styleType ?? "pill";
  wrapper.className = `inline-fold-wrapper inline-fold-theme-${styleType}`;
  // Stable per-class hook independent of styleType, so a CSS snippet can
  // target one specific class (e.g. give just "Flashcard Answer" its own
  // look) without needing to fight or duplicate the theme rules.
  if (foldClass) wrapper.classList.add(`inline-fold-class-${foldClass.id}`);
  // Expanded/collapsed and hover-revealed visibility are driven entirely
  // by CSS (see styles.css) via these two classes, deliberately never by
  // element.style.display — inline styles would out-rank the hover CSS
  // rule (equal-or-higher stylesheet specificity can't beat an inline
  // style), which is exactly the trap the old plugin's approach of
  // writing every visual state directly to .style.* made unavoidable.
  wrapper.classList.toggle("is-expanded", expanded);

  if (styleType !== "custom" || !foldClass) return;

  for (const [cssVar, field] of Object.entries(CUSTOM_PROPERTY_MAP)) {
    wrapper.style.setProperty(cssVar, String(foldClass[field]));
  }
}
