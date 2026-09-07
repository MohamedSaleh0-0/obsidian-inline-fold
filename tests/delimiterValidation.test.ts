import { describe, expect, it } from "vitest";
import { findDelimiterCollisions, findInvalidRegexClasses } from "../src/core/delimiterValidation";
import { FoldClass } from "../src/core/types";

function makeClass(overrides: Partial<FoldClass> = {}): FoldClass {
  return {
    id: "test",
    name: "Test",
    startSymbol: "[=",
    endSymbol: "=]",
    styleType: "pill",
    triggerText: "?",
    icon: "",
    useRegex: false,
    customTextColor: "",
    customBgColor: "",
    customBorderColor: "",
    customBorderStyle: "solid",
    customBorderWidth: "",
    customBorderRadius: "",
    customPadding: "",
    customFontSize: "",
    ...overrides,
  };
}

describe("findDelimiterCollisions", () => {
  it("reports no collisions for distinct, non-overlapping symbols", () => {
    const a = makeClass({ id: "a", startSymbol: "[=", endSymbol: "=]" });
    const b = makeClass({ id: "b", startSymbol: "{{", endSymbol: "}}" });
    expect(findDelimiterCollisions([a, b])).toHaveLength(0);
  });

  it("flags an exact duplicate start symbol on the later class", () => {
    const a = makeClass({ id: "a", name: "First", startSymbol: "[=" });
    const b = makeClass({ id: "b", name: "Second", startSymbol: "[=" });
    const collisions = findDelimiterCollisions([a, b]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({ classId: "b", shadowedByClassId: "a", reason: "duplicate" });
  });

  it("flags a later class whose start symbol is a prefix-extension of an earlier one", () => {
    const a = makeClass({ id: "a", name: "Short", startSymbol: "[" });
    const b = makeClass({ id: "b", name: "Long", startSymbol: "[[" });
    const collisions = findDelimiterCollisions([a, b]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({ classId: "b", shadowedByClassId: "a", reason: "prefix" });
  });

  it("does not flag when the shorter symbol comes after the longer one", () => {
    const a = makeClass({ id: "a", startSymbol: "[[" });
    const b = makeClass({ id: "b", startSymbol: "[" });
    // "[[".startsWith("[") is true, but here the SHORTER one is later —
    // it shadows the longer one which comes first, not the reverse, so
    // it's the longer (earlier) class that's actually fine; the shorter
    // (later) one is the one that would be shadowed going forward, which
    // isn't the case since it comes second and matches immediately.
    // Only the later class is ever checked against earlier ones.
    expect(findDelimiterCollisions([a, b])).toHaveLength(0);
  });

  it("ignores classes with an empty start symbol", () => {
    const a = makeClass({ id: "a", startSymbol: "" });
    const b = makeClass({ id: "b", startSymbol: "[=" });
    expect(findDelimiterCollisions([a, b])).toHaveLength(0);
  });

  it("does not compare regex-delimiter classes as if they were literal text", () => {
    const a = makeClass({ id: "a", startSymbol: "[", useRegex: false });
    const b = makeClass({ id: "b", startSymbol: "[", useRegex: true });
    // Same source string, but b is a regex class — comparing them as
    // literal prefixes wouldn't be meaningful, so this should not flag.
    expect(findDelimiterCollisions([a, b])).toHaveLength(0);
  });
});

describe("findInvalidRegexClasses", () => {
  it("reports nothing for a non-regex class regardless of its symbols", () => {
    const cls = makeClass({ startSymbol: "(unbalanced", useRegex: false });
    expect(findInvalidRegexClasses([cls])).toHaveLength(0);
  });

  it("reports nothing for valid regex delimiters", () => {
    const cls = makeClass({ startSymbol: "\\[=+", endSymbol: "=+\\]", useRegex: true });
    expect(findInvalidRegexClasses([cls])).toHaveLength(0);
  });

  it("flags an invalid start pattern", () => {
    const cls = makeClass({ startSymbol: "(unbalanced", endSymbol: "=]", useRegex: true });
    const issues = findInvalidRegexClasses([cls]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ classId: "test", field: "start" });
  });

  it("flags both fields independently when both are invalid", () => {
    const cls = makeClass({ startSymbol: "(bad", endSymbol: "[bad", useRegex: true });
    const issues = findInvalidRegexClasses([cls]);
    expect(issues.map((i) => i.field).sort()).toEqual(["end", "start"]);
  });
});
