import { describe, expect, it } from "vitest";
import { determineRenderMode, usesPopover } from "../src/core/revealMode";

describe("determineRenderMode", () => {
  it("defaults to inline when the class is missing (orphaned classId)", () => {
    expect(determineRenderMode(undefined)).toBe("inline");
  });

  it("is inline when content is hidden and reveal style is inline", () => {
    expect(determineRenderMode({ contentVisibility: "hidden", revealStyle: "inline" })).toBe("inline");
  });

  it("is popover-fold when content is hidden and reveal style is popover", () => {
    expect(determineRenderMode({ contentVisibility: "hidden", revealStyle: "popover" })).toBe("popover-fold");
  });

  it("is annotation when content is visible, regardless of reveal style", () => {
    expect(determineRenderMode({ contentVisibility: "visible", revealStyle: "inline" })).toBe("annotation");
    expect(determineRenderMode({ contentVisibility: "visible", revealStyle: "popover" })).toBe("annotation");
  });
});

describe("usesPopover", () => {
  it("is false only for the classic inline fold", () => {
    expect(usesPopover({ contentVisibility: "hidden", revealStyle: "inline" })).toBe(false);
  });

  it("is true for popover-mode folds and all annotations", () => {
    expect(usesPopover({ contentVisibility: "hidden", revealStyle: "popover" })).toBe(true);
    expect(usesPopover({ contentVisibility: "visible", revealStyle: "inline" })).toBe(true);
    expect(usesPopover({ contentVisibility: "visible", revealStyle: "popover" })).toBe(true);
  });
});
