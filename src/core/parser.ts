import { FoldClass, FoldNode } from "./types";

interface StackFrame {
  foldClass: FoldClass | null; // null marks the virtual root frame
  index: number; // position of the start symbol within `text`
  matchedStartLength: number; // actual matched length — may differ from startSymbol.length for regex classes
  children: FoldNode[];
}

function compileSticky(source: string): RegExp | null {
  if (!source) return null;
  try {
    return new RegExp(source, "y");
  } catch {
    return null; // invalid pattern — treated as "never matches" rather than crashing the parse
  }
}

/**
 * Parses fold delimiters out of a line of text into a tree of FoldNode.
 *
 * This is a pure function of (classes, text) — no Obsidian API, no
 * global state — so it's unit-testable in isolation and safely reusable
 * from Live Preview, Reading view, and commands alike.
 *
 * Nesting is genuine: an end symbol always closes the innermost
 * currently-open fold (standard nested-bracket matching generalized
 * across however many delimiter pairs are configured). Overlapping,
 * non-nested folds are simply not possible by construction.
 *
 * A class can opt into regex delimiters (FoldClass.useRegex) — start/end
 * are then compiled as sticky (`y` flag) regexes and matched anchored at
 * the current position instead of a literal startsWith(). Everything
 * else about the algorithm (the stack, nesting, alias splitting) stays
 * identical; only how a start/end symbol is recognized changes.
 */
export class FoldParser {
  private compiledRegex = new Map<string, { start: RegExp | null; end: RegExp | null }>();

  constructor(private classes: FoldClass[]) {
    for (const cls of classes) {
      if (!cls.useRegex) continue;
      this.compiledRegex.set(cls.id, {
        start: compileSticky(cls.startSymbol),
        end: compileSticky(cls.endSymbol),
      });
    }
  }

  parseLine(text: string, lineOffset: number): FoldNode[] {
    const root: StackFrame = { foldClass: null, index: -1, matchedStartLength: 0, children: [] };
    const stack: StackFrame[] = [root];
    let i = 0;

    while (i < text.length) {
      const top = stack[stack.length - 1];

      const endLen = top.foldClass ? this.matchLength(top.foldClass, "end", text, i) : null;
      if (top.foldClass && endLen !== null) {
        const frame = stack.pop() as StackFrame;
        const cls = frame.foldClass as FoldClass;
        const from = lineOffset + frame.index;
        const to = lineOffset + i + endLen;
        const innerStart = frame.index + frame.matchedStartLength;
        const raw = text.substring(innerStart, i);
        const { content, alias } = FoldParser.splitContentAndAlias(raw);

        const node: FoldNode = {
          from,
          to,
          contentFrom: lineOffset + innerStart,
          content,
          alias,
          classId: cls.id,
          children: frame.children,
        };
        stack[stack.length - 1].children.push(node);
        i += endLen;
        continue;
      }

      let opened = false;
      for (const cls of this.classes) {
        const startLen = this.matchLength(cls, "start", text, i);
        if (startLen !== null) {
          stack.push({ foldClass: cls, index: i, matchedStartLength: startLen, children: [] });
          i += startLen;
          opened = true;
          break;
        }
      }
      if (!opened) i++;
    }

    // Any still-open frames on the stack are unterminated folds (the user
    // is mid-typing an end symbol) — intentionally dropped, matching the
    // old behaviour of only surfacing complete pairs.
    return root.children;
  }

  /** Length of the match at position i for a class's start/end symbol, or null if none. */
  private matchLength(cls: FoldClass, which: "start" | "end", text: string, i: number): number | null {
    const pattern = which === "start" ? cls.startSymbol : cls.endSymbol;

    if (cls.useRegex) {
      const compiled = this.compiledRegex.get(cls.id);
      const regex = which === "start" ? compiled?.start : compiled?.end;
      if (!regex) return null;
      regex.lastIndex = i;
      const match = regex.exec(text);
      // A zero-length match would never advance `i`, looping forever —
      // treat it as no match at all.
      if (match && match.index === i && match[0].length > 0) return match[0].length;
      return null;
    }

    if (pattern.length > 0 && text.startsWith(pattern, i)) return pattern.length;
    return null;
  }

  /**
   * Splits raw delimiter content into content/alias on the first
   * unescaped "|". A "|" preceded by a backslash is treated as literal
   * and unescaped in the result — so `[=A \| B=]` folds to the content
   * `A | B` with no alias, instead of splitting on that pipe.
   *
   * This only handles the one escape (`\|` → `|`); it isn't a general
   * backslash-escaping grammar, so a literal backslash immediately
   * before a real separator can't itself be escaped. Kept deliberately
   * simple for the one case that actually comes up.
   */
  static splitContentAndAlias(raw: string): { content: string; alias?: string } {
    let sepIndex = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === "|" && raw[i - 1] !== "\\") {
        sepIndex = i;
        break;
      }
    }
    const unescape = (s: string): string => s.replace(/\\\|/g, "|");
    if (sepIndex === -1) return { content: unescape(raw) };
    return {
      content: unescape(raw.substring(0, sepIndex)),
      alias: unescape(raw.substring(sepIndex + 1)),
    };
  }
}
