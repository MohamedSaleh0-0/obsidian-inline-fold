import { describe, expect, it } from "vitest";
import { FoldParser } from "../src/core/parser";
import { assignFoldKeys, flattenFoldTree } from "../src/core/foldTree";
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

describe("assignFoldKeys", () => {
  it("gives identical class+content folds the same base key on first occurrence", () => {
    const parser = new FoldParser([makeClass()]);
    const nodes = parser.parseLine("[=Paris=]", 0);
    const keys = assignFoldKeys(nodes);
    expect(keys.get(nodes[0])).toBe("test::Paris");
  });

  it("disambiguates duplicate class+content pairs by occurrence order", () => {
    const parser = new FoldParser([makeClass()]);
    const nodes = parser.parseLine("[=Paris=] ... [=Paris=]", 0);
    const keys = assignFoldKeys(nodes);
    expect(keys.get(nodes[0])).toBe("test::Paris");
    expect(keys.get(nodes[1])).toBe("test::Paris::1");
  });

  it("is stable across re-parses of unchanged text (survives reload/restart)", () => {
    const parser = new FoldParser([makeClass()]);
    const first = assignFoldKeys(parser.parseLine("[=Paris=] and [=Lyon=]", 0));
    const second = assignFoldKeys(parser.parseLine("[=Paris=] and [=Lyon=]", 0));
    expect([...first.values()]).toEqual([...second.values()]);
  });

  it("is unaffected by inserting an unrelated fold earlier in the line", () => {
    const parser = new FoldParser([makeClass()]);
    const before = assignFoldKeys(parser.parseLine("[=Paris=]", 0));
    const after = assignFoldKeys(parser.parseLine("[=Berlin=] [=Paris=]", 0));
    // content-based keys, unlike raw offsets, don't shift when something
    // is inserted earlier in the document
    const beforeNodes = parser.parseLine("[=Paris=]", 0);
    const afterNodes = parser.parseLine("[=Berlin=] [=Paris=]", 0);
    expect(before.get(beforeNodes[0])).toBe(after.get(afterNodes[1]));
  });

  it("assigns keys to nested children too", () => {
    const outer = makeClass({ id: "outer", startSymbol: "[[", endSymbol: "]]" });
    const inner = makeClass({ id: "inner" });
    const parser = new FoldParser([outer, inner]);
    const nodes = parser.parseLine("[[a [=b=]]]", 0);
    const keys = assignFoldKeys(nodes);
    expect(keys.get(nodes[0].children[0])).toBe("inner::b");
  });
});

describe("flattenFoldTree", () => {
  it("includes nested nodes at every depth", () => {
    const outer = makeClass({ id: "outer", startSymbol: "[[", endSymbol: "]]" });
    const inner = makeClass({ id: "inner" });
    const parser = new FoldParser([outer, inner]);
    const nodes = parser.parseLine("[[a [=b=] c]]", 0);
    const flat = flattenFoldTree(nodes);
    expect(flat.map((n) => n.classId)).toEqual(["outer", "inner"]);
  });
});
