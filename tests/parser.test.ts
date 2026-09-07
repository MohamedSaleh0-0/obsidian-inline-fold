import { describe, expect, it } from "vitest";
import { FoldParser } from "../src/core/parser";
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

describe("FoldParser", () => {
  it("parses a single fold with correct positions", () => {
    const parser = new FoldParser([makeClass()]);
    const [node] = parser.parseLine("The answer is [=Paris=].", 0);
    expect(node.content).toBe("Paris");
    expect(node.from).toBe(14);
    expect(node.to).toBe(23);
    expect(node.children).toHaveLength(0);
  });

  it("splits alias from content on |", () => {
    const parser = new FoldParser([makeClass()]);
    const [node] = parser.parseLine("[=Paris|France's capital=]", 0);
    expect(node.content).toBe("Paris");
    expect(node.alias).toBe("France's capital");
  });

  it("supports multiple non-overlapping folds on one line", () => {
    const parser = new FoldParser([makeClass()]);
    const nodes = parser.parseLine("[=a=] and [=b=]", 0);
    expect(nodes.map((n) => n.content)).toEqual(["a", "b"]);
  });

  it("builds a real tree for nested folds instead of discarding them", () => {
    const outer = makeClass({ id: "outer", startSymbol: "[[", endSymbol: "]]" });
    const inner = makeClass({ id: "inner", startSymbol: "[=", endSymbol: "=]" });
    const parser = new FoldParser([outer, inner]);

    const [node] = parser.parseLine("[[Paris is [=hint: capital=] of France]]", 0);
    expect(node.classId).toBe("outer");
    expect(node.children).toHaveLength(1);
    expect(node.children[0].classId).toBe("inner");
    expect(node.children[0].content).toBe("hint: capital");
    // The outer node's raw content still contains the nested delimiters verbatim.
    expect(node.content).toContain("[=hint: capital=]");
  });

  it("supports three levels of nesting", () => {
    const a = makeClass({ id: "a", startSymbol: "(", endSymbol: ")" });
    const b = makeClass({ id: "b", startSymbol: "[", endSymbol: "]" });
    const c = makeClass({ id: "c", startSymbol: "{", endSymbol: "}" });
    const parser = new FoldParser([a, b, c]);

    const [node] = parser.parseLine("(one [two {three}])", 0);
    expect(node.classId).toBe("a");
    expect(node.children[0].classId).toBe("b");
    expect(node.children[0].children[0].classId).toBe("c");
    expect(node.children[0].children[0].content).toBe("three");
  });

  it("closes only the innermost open fold on a matching end symbol", () => {
    const cls = makeClass();
    const parser = new FoldParser([cls]);
    const nodes = parser.parseLine("[=outer [=inner=] tail=]", 0);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].children).toHaveLength(1);
    expect(nodes[0].children[0].content).toBe("inner");
  });

  it("leaves unterminated folds out of the result", () => {
    const parser = new FoldParser([makeClass()]);
    const nodes = parser.parseLine("this has [=no closing delimiter", 0);
    expect(nodes).toHaveLength(0);
  });

  it("ignores classes with an empty start symbol", () => {
    const parser = new FoldParser([makeClass({ startSymbol: "" })]);
    expect(() => parser.parseLine("anything", 0)).not.toThrow();
    expect(parser.parseLine("anything", 0)).toHaveLength(0);
  });

  it("treats an escaped pipe as literal content, not an alias separator", () => {
    const parser = new FoldParser([makeClass()]);
    const [node] = parser.parseLine("[=A \\| B=]", 0);
    expect(node.content).toBe("A | B");
    expect(node.alias).toBeUndefined();
  });

  it("still splits on a real, unescaped pipe after an escaped one", () => {
    const parser = new FoldParser([makeClass()]);
    const [node] = parser.parseLine("[=A \\| B|my alias=]", 0);
    expect(node.content).toBe("A | B");
    expect(node.alias).toBe("my alias");
  });

  it("records contentFrom as the absolute offset right after the start delimiter", () => {
    const parser = new FoldParser([makeClass()]);
    const [node] = parser.parseLine("hi [=Paris=]", 0);
    // "hi [=" is 5 chars, so content starts at offset 5
    expect(node.contentFrom).toBe(5);
    expect(node.content).toBe("Paris");
  });
});

describe("FoldParser regex delimiters", () => {
  it("matches a regex start/end pair instead of literal text", () => {
    const cls = makeClass({ startSymbol: "\\[=+", endSymbol: "=+\\]", useRegex: true });
    const parser = new FoldParser([cls]);
    const [node] = parser.parseLine("[===Paris===]", 0);
    expect(node.content).toBe("Paris");
  });

  it("computes contentFrom correctly when the matched length differs from the pattern source length", () => {
    // source "-+" is 2 chars, but greedily matches all 5 consecutive
    // dashes — proves contentFrom comes from the actual match, not
    // startSymbol.length (which would be wrong here: 2, not 5)
    const cls = makeClass({ startSymbol: "-+", endSymbol: "-+", useRegex: true });
    const parser = new FoldParser([cls]);
    const [node] = parser.parseLine("-----Paris-----", 0);
    expect(node.content).toBe("Paris");
    expect(node.contentFrom).toBe(5);
    expect(node.from).toBe(0);
    expect(node.to).toBe(15);
  });

  it("falls back to no match (not a crash) for an invalid regex", () => {
    const cls = makeClass({ startSymbol: "(unterminated", endSymbol: "=]", useRegex: true });
    const parser = new FoldParser([cls]);
    expect(() => parser.parseLine("(unterminated foo=]", 0)).not.toThrow();
    expect(parser.parseLine("(unterminated foo=]", 0)).toHaveLength(0);
  });

  it("does not infinite-loop on a zero-width-matching start pattern", () => {
    const cls = makeClass({ startSymbol: "x*", endSymbol: "=]", useRegex: true });
    const parser = new FoldParser([cls]);
    expect(() => parser.parseLine("some plain text=]", 0)).not.toThrow();
  });

  it("supports nesting with regex classes just like literal ones", () => {
    const outer = makeClass({ id: "outer", startSymbol: "\\(+", endSymbol: "\\)+", useRegex: true });
    const inner = makeClass({ id: "inner" });
    const parser = new FoldParser([outer, inner]);
    const [node] = parser.parseLine("((a [=b=] c))", 0);
    expect(node.classId).toBe("outer");
    expect(node.children[0].classId).toBe("inner");
    expect(node.children[0].content).toBe("b");
  });
});
