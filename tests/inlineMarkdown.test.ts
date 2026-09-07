import { describe, expect, it } from "vitest";
import { InlineNode, parseInlineMarkdown } from "../src/core/inlineMarkdown";

describe("parseInlineMarkdown", () => {
  it("returns a single text node for plain text", () => {
    expect(parseInlineMarkdown("just plain text")).toEqual([{ type: "text", value: "just plain text" }]);
  });

  it("parses bold with **", () => {
    expect(parseInlineMarkdown("**bold**")).toEqual([{ type: "bold", children: [{ type: "text", value: "bold" }] }]);
  });

  it("parses bold with __", () => {
    expect(parseInlineMarkdown("__bold__")).toEqual([{ type: "bold", children: [{ type: "text", value: "bold" }] }]);
  });

  it("parses italic with single * and _", () => {
    expect(parseInlineMarkdown("*i*")).toEqual([{ type: "italic", children: [{ type: "text", value: "i" }] }]);
    expect(parseInlineMarkdown("_i_")).toEqual([{ type: "italic", children: [{ type: "text", value: "i" }] }]);
  });

  it("parses inline code", () => {
    expect(parseInlineMarkdown("`code`")).toEqual([{ type: "code", value: "code" }]);
  });

  it("does not interpret markdown inside code spans", () => {
    expect(parseInlineMarkdown("`**not bold**`")).toEqual([{ type: "code", value: "**not bold**" }]);
  });

  it("parses a markdown link", () => {
    expect(parseInlineMarkdown("[Anthropic](https://anthropic.com)")).toEqual([
      { type: "link", label: [{ type: "text", value: "Anthropic" }], url: "https://anthropic.com" },
    ]);
  });

  it("parses a wikilink without an alias", () => {
    expect(parseInlineMarkdown("[[Some Note]]")).toEqual([{ type: "wikilink", target: "Some Note" }]);
  });

  it("parses a wikilink with an alias", () => {
    expect(parseInlineMarkdown("[[Some Note|display text]]")).toEqual([
      { type: "wikilink", target: "Some Note", alias: "display text" },
    ]);
  });

  it("mixes plain text and formatting in sequence", () => {
    const result = parseInlineMarkdown("The capital is **Paris**, in `France`.");
    expect(result).toEqual([
      { type: "text", value: "The capital is " },
      { type: "bold", children: [{ type: "text", value: "Paris" }] },
      { type: "text", value: ", in " },
      { type: "code", value: "France" },
      { type: "text", value: "." },
    ]);
  });

  it("recurses into bold to find nested italic", () => {
    const result = parseInlineMarkdown("**bold *and italic* text**");
    expect(result).toEqual([
      {
        type: "bold",
        children: [
          { type: "text", value: "bold " },
          { type: "italic", children: [{ type: "text", value: "and italic" }] },
          { type: "text", value: " text" },
        ],
      },
    ]);
  });

  it("recurses into a link label for nested formatting", () => {
    const result = parseInlineMarkdown("[**bold link**](url)");
    expect(result).toEqual([
      {
        type: "link",
        label: [{ type: "bold", children: [{ type: "text", value: "bold link" }] }],
        url: "url",
      },
    ]);
  });

  it("treats an unclosed marker as literal text rather than throwing", () => {
    expect(() => parseInlineMarkdown("**never closed")).not.toThrow();
    const result = parseInlineMarkdown("**never closed");
    expect(result).toEqual([{ type: "text", value: "**never closed" }]);
  });

  it("degrades gracefully for a run of bare asterisks", () => {
    expect(() => parseInlineMarkdown("****")).not.toThrow();
    const result = parseInlineMarkdown("****") as InlineNode[];
    // every node collapses to plain text, no empty bold/italic nodes
    expect(result.every((n) => n.type === "text")).toBe(true);
    expect(result.map((n) => (n as { value: string }).value).join("")).toBe("****");
  });

  it("does not throw on an empty string", () => {
    expect(parseInlineMarkdown("")).toEqual([]);
  });

  it("does not treat an unmatched single bracket as a link", () => {
    expect(parseInlineMarkdown("[not a link")).toEqual([{ type: "text", value: "[not a link" }]);
  });
});
