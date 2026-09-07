import { describe, expect, it } from "vitest";
import { computeAutoPairEndSymbol } from "../src/core/autoPair";
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

describe("computeAutoPairEndSymbol", () => {
  it("returns the end symbol once the start symbol has just been typed", () => {
    const result = computeAutoPairEndSymbol("hello [=", "", [makeClass()]);
    expect(result).toBe("=]");
  });

  it("returns null when the preceding text doesn't end with any start symbol", () => {
    const result = computeAutoPairEndSymbol("hello [", "", [makeClass()]);
    expect(result).toBeNull();
  });

  it("does not duplicate when the end symbol is already right there", () => {
    const result = computeAutoPairEndSymbol("[=", "=]", [makeClass()]);
    expect(result).toBeNull();
  });

  it("skips classes with identical start and end symbols (symmetric, ambiguous)", () => {
    const result = computeAutoPairEndSymbol("hello ==", "", [makeClass({ startSymbol: "==", endSymbol: "==" })]);
    expect(result).toBeNull();
  });

  it("checks classes in order and returns the first match", () => {
    const a = makeClass({ id: "a", startSymbol: "[[", endSymbol: "]]" });
    const b = makeClass({ id: "b", startSymbol: "[", endSymbol: "]" });
    const result = computeAutoPairEndSymbol("x [[", "", [a, b]);
    expect(result).toBe("]]");
  });

  it("handles multi-character symbols", () => {
    const cls = makeClass({ startSymbol: "{{", endSymbol: "}}" });
    expect(computeAutoPairEndSymbol("note {{", "", [cls])).toBe("}}");
    expect(computeAutoPairEndSymbol("note {", "", [cls])).toBeNull();
  });

  it("skips regex-delimiter classes — a pattern source isn't literal text to insert", () => {
    const cls = makeClass({ startSymbol: "\\[=+", endSymbol: "=+\\]", useRegex: true });
    const result = computeAutoPairEndSymbol("hello \\[=+", "", [cls]);
    expect(result).toBeNull();
  });
});
