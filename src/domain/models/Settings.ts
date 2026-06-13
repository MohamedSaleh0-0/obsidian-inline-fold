export interface FoldClass {
    id: string;
    name: string;
    startSymbol: string;
    endSymbol: string;
    styleType: "ghost" | "pill" | "bracket" | "custom";
    triggerText: string;
    customTextColor: string;
    customBgColor: string;
    customBorderColor: string;
    customBorderStyle: "none" | "solid" | "dashed" | "dotted";
    customBorderWidth: string;
    customBorderRadius: string;
    customPadding: string;
    customFontSize: string;
}

export interface CapsuleSettings {
    interactionMode: "click" | "hover" | "both";
    linkCursorToExpansion: "atomicOnCollapse" | "alwaysReveal";
    protectCollapsedBoundaries: boolean;
    hotkeyExpansionTarget: "line" | "closest";
    hoverCollapseDelay: number;
    classes: FoldClass[];
}

export const DEFAULT_SETTINGS: CapsuleSettings = {
    interactionMode: "both",
    linkCursorToExpansion: "atomicOnCollapse",
    protectCollapsedBoundaries: true,
    hotkeyExpansionTarget: "line",
    hoverCollapseDelay: 200,
    classes: [
        {
            id: "default-fold",
            name: "Default Fold",
            startSymbol: "[=",
            endSymbol: "=]",
            styleType: "ghost",
            triggerText: "..",
            customTextColor: "var(--text-normal)",
            customBgColor: "var(--background-modifier-form-field)",
            customBorderColor: "var(--background-modifier-border)",
            customBorderStyle: "solid",
            customBorderWidth: "1px",
            customBorderRadius: "4px",
            customPadding: "2px 6px",
            customFontSize: "inherit"
        }
    ]
};