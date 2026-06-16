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
            id: "default-flashcard",
            name: "Flashcard Answer",
            startSymbol: "[=",
            endSymbol: "=]",
            styleType: "pill",
            triggerText: "?",
            customTextColor: "var(--text-accent)",
            customBgColor: "var(--background-primary-alt)",
            customBorderColor: "var(--interactive-accent)",
            customBorderStyle: "solid",
            customBorderWidth: "1px",
            customBorderRadius: "6px",
            customPadding: "2px 8px",
            customFontSize: "0.95em"
        }
    ]
};