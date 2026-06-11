export interface CapsuleSettings {
    styleType: "ghost" | "pill" | "bracket" | "custom";
    interactionMode: "click" | "hover" | "both";
    cursorBehavior: "reveal" | "bypass";
    startSymbol: string;
    endSymbol: string;
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

export const DEFAULT_SETTINGS: CapsuleSettings = {
    styleType: "ghost",
    interactionMode: "both",
    cursorBehavior: "reveal",
    startSymbol: "[=",
    endSymbol: "=]",
    triggerText: "..",
    customTextColor: "var(--text-normal)",
    customBgColor: "var(--background-modifier-form-field)",
    customBorderColor: "var(--background-modifier-border)",
    customBorderStyle: "solid",
    customBorderWidth: "1px",
    customBorderRadius: "4px",
    customPadding: "2px 6px",
    customFontSize: "inherit"
};