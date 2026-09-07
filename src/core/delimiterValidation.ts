import { FoldClass } from "./types";

export interface DelimiterCollision {
  classId: string;
  className: string;
  shadowedByClassId: string;
  shadowedByClassName: string;
  reason: "duplicate" | "prefix";
}

/**
 * Finds fold classes whose start symbol can never actually trigger,
 * because an earlier class in the list has an identical or
 * prefix-matching start symbol.
 *
 * The parser tries classes in array order and takes the first
 * text.startsWith() match at each position — so if class A's start
 * symbol is "[" and class B's is "[[", B is unreachable wherever A
 * comes first in the list, since "[[" always starts with "[" too, and
 * A wins the match before B ever gets a chance.
 *
 * Regex-delimiter classes are skipped: comparing two regex source
 * strings as if they were literal text isn't meaningful (and general
 * regex-overlap detection isn't something this attempts).
 */
export function findDelimiterCollisions(classes: FoldClass[]): DelimiterCollision[] {
  const collisions: DelimiterCollision[] = [];

  for (let laterIndex = 0; laterIndex < classes.length; laterIndex++) {
    const later = classes[laterIndex];
    if (!later.startSymbol || later.useRegex) continue;

    for (let earlierIndex = 0; earlierIndex < laterIndex; earlierIndex++) {
      const earlier = classes[earlierIndex];
      if (!earlier.startSymbol || earlier.useRegex) continue;

      if (earlier.startSymbol === later.startSymbol) {
        collisions.push({
          classId: later.id,
          className: later.name,
          shadowedByClassId: earlier.id,
          shadowedByClassName: earlier.name,
          reason: "duplicate",
        });
      } else if (later.startSymbol.startsWith(earlier.startSymbol)) {
        collisions.push({
          classId: later.id,
          className: later.name,
          shadowedByClassId: earlier.id,
          shadowedByClassName: earlier.name,
          reason: "prefix",
        });
      }
    }
  }

  return collisions;
}

export interface InvalidRegexIssue {
  classId: string;
  className: string;
  field: "start" | "end";
  message: string;
}

/**
 * Finds regex-delimiter classes whose start or end pattern doesn't
 * actually compile, so the settings UI can surface it instead of the
 * class just silently never matching anything at parse time.
 */
export function findInvalidRegexClasses(classes: FoldClass[]): InvalidRegexIssue[] {
  const issues: InvalidRegexIssue[] = [];

  for (const cls of classes) {
    if (!cls.useRegex) continue;
    for (const field of ["start", "end"] as const) {
      const source = field === "start" ? cls.startSymbol : cls.endSymbol;
      try {
        new RegExp(source, "y");
      } catch (err) {
        issues.push({
          classId: cls.id,
          className: cls.name,
          field,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return issues;
}
