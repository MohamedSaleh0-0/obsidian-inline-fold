import { FoldClass } from "./types";

/**
 * Given the text immediately before and after a just-moved cursor,
 * decides whether a class's end symbol should be auto-inserted — the
 * same idea as bracket/quote auto-closing.
 *
 * Deliberately pure (just two small text windows in, an end symbol or
 * null out) so it's unit-testable without a CM6 EditorState; the CM6
 * wiring (live-preview/autoPair.ts) only has to slice the right-sized
 * windows around the cursor and apply the result.
 *
 * Classes whose start and end symbols are identical (e.g. a class using
 * "==" for both) are skipped — auto-pairing symmetric delimiters is
 * ambiguous (is a typed "=" opening or closing?) and would need a
 * separate "type through" behavior this doesn't attempt.
 *
 * Regex-delimiter classes are skipped too: startSymbol/endSymbol are
 * pattern source strings there, not literal text to insert.
 */
export function computeAutoPairEndSymbol(
  precedingText: string,
  followingText: string,
  classes: FoldClass[],
): string | null {
  for (const cls of classes) {
    if (!cls.startSymbol || !cls.endSymbol) continue;
    if (cls.startSymbol === cls.endSymbol) continue;
    if (cls.useRegex) continue; // a regex source string isn't literal text to insert
    if (!precedingText.endsWith(cls.startSymbol)) continue;
    if (followingText.startsWith(cls.endSymbol)) continue; // already paired, don't duplicate
    return cls.endSymbol;
  }
  return null;
}
