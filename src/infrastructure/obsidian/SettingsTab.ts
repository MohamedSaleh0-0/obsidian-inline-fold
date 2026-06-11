import { PluginSettingTab, App, Setting } from "obsidian";
import InlineCapsulePlugin from "../../main";

export class InlineCapsuleSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: InlineCapsulePlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Inline Capsule Ultimate Settings" });

        // 1. القائمة الأساسية للثيمات
        new Setting(containerEl)
            .setName("Capsule Visual Theme")
            .setDesc("Toggle the layout configuration or unlock fully customizable parameters.")
            .addDropdown(dropdown => dropdown
                .addOption("ghost", "Ghost Inline")
                .addOption("pill", "Smart Pill")
                .addOption("bracket", "Bracket Block")
                .addOption("custom", "Custom Layout (Unlock Controls Below)")
                .setValue(this.plugin.settings.styleType)
                .onChange(async (value: string) => {
                    this.plugin.settings.styleType = value as "ghost" | "pill" | "bracket" | "custom";
                    await this.plugin.saveSettings();
                    this.display(); 
                }));

        // 2. نمط التفاعل
        new Setting(containerEl)
            .setName("Interaction Trigger Mode")
            .setDesc("Choose how the capsule expands (Hover vs Click vs Both).")
            .addDropdown(dropdown => dropdown
                .addOption("click", "Click Only")
                .addOption("hover", "Hover Only")
                .addOption("both", "Dual Mode")
                .setValue(this.plugin.settings.interactionMode)
                .onChange(async (value: string) => {
                    this.plugin.settings.interactionMode = value as "click" | "hover" | "both";
                    await this.plugin.saveSettings();
                }));

        // 3. سلوك المؤشر
        new Setting(containerEl)
            .setName("Cursor Interactive Behavior")
            .setDesc("Control cursor skipping or markdown reveal behavior.")
            .addDropdown(dropdown => dropdown
                .addOption("reveal", "Reveal Markdown on Selection")
                .addOption("bypass", "Keep Collapsed (Atomic Cursor Skip)")
                .setValue(this.plugin.settings.cursorBehavior)
                .onChange(async (value: string) => {
                    this.plugin.settings.cursorBehavior = value as "reveal" | "bypass";
                    await this.plugin.saveSettings();
                }));

        // 4. رمز الفتح - مسترجع وثابت
        new Setting(containerEl)
            .setName("Opening Delimiter")
            .setDesc("The symbol string that begins a capsule block.")
            .addText(text => text
                .setPlaceholder("[=")
                .setValue(this.plugin.settings.startSymbol)
                .onChange(async (value) => {
                    this.plugin.settings.startSymbol = value || "[=";
                    await this.plugin.saveSettings();
                }));

        // 5. رمز الإغلاق - مسترجع وثابت
        new Setting(containerEl)
            .setName("Closing Delimiter")
            .setDesc("The symbol string that terminates a capsule block.")
            .addText(text => text
                .setPlaceholder("=]")
                .setValue(this.plugin.settings.endSymbol)
                .onChange(async (value) => {
                    this.plugin.settings.endSymbol = value || "=]";
                    await this.plugin.saveSettings();
                }));

        // 6. نص المؤشر المخفي - مسترجع وثابت
        new Setting(containerEl)
            .setName("Collapsed Indicator Text")
            .setDesc("The string displayed inside sentences when data is hidden.")
            .addText(text => text
                .setPlaceholder("..")
                .setValue(this.plugin.settings.triggerText)
                .onChange(async (value) => {
                    this.plugin.settings.triggerText = value || "..";
                    await this.plugin.saveSettings();
                }));

        // كتل التحكم البصري الفائق الشاملة (تفتح فقط عند اختيار الخيار المخصص)
        if (this.plugin.settings.styleType === "custom") {
            containerEl.createEl("h3", { text: "Advanced Micro-Styling Panels" });

            new Setting(containerEl)
                .setName("Text Color")
                .setDesc("Supports Hex, RGB, or native Obsidian variables (e.g. var(--text-normal)).")
                .addText(text => text
                    .setValue(this.plugin.settings.customTextColor)
                    .onChange(async (val) => {
                        this.plugin.settings.customTextColor = val || "inherit";
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName("Background Color")
                .setDesc("Set the primary background container color layout.")
                .addText(text => text
                    .setValue(this.plugin.settings.customBgColor)
                    .onChange(async (val) => {
                        this.plugin.settings.customBgColor = val || "transparent";
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName("Border Style")
                .setDesc("Choose the border decoration surrounding the token.")
                .addDropdown(drop => drop
                    .addOption("none", "None")
                    .addOption("solid", "Solid Line")
                    .addOption("dashed", "Dashed Line")
                    .addOption("dotted", "Dotted Line")
                    .setValue(this.plugin.settings.customBorderStyle)
                    .onChange(async (val: string) => {
                        this.plugin.settings.customBorderStyle = val as "none" | "solid" | "dashed" | "dotted";
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName("Border Color")
                .setDesc("Set the color outlining your custom border.")
                .addText(text => text
                    .setValue(this.plugin.settings.customBorderColor)
                    .onChange(async (val) => {
                        this.plugin.settings.customBorderColor = val || "transparent";
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName("Border Radius")
                .setDesc("Control border corner roundness (e.g. 4px or 12px for pills).")
                .addText(text => text
                    .setValue(this.plugin.settings.customBorderRadius)
                    .onChange(async (val) => {
                        this.plugin.settings.customBorderRadius = val || "0px";
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName("Custom Padding")
                .setDesc("Internal spacing boundaries (e.g. 2px 6px).")
                .addText(text => text
                    .setValue(this.plugin.settings.customPadding)
                    .onChange(async (val) => {
                        this.plugin.settings.customPadding = val || "0px";
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName("Font Size Adjustments")
                .setDesc("Scale the text elements size constraints (e.g. 0.9em or inherit).")
                .addText(text => text
                    .setValue(this.plugin.settings.customFontSize)
                    .onChange(async (val) => {
                        this.plugin.settings.customFontSize = val || "inherit";
                        await this.plugin.saveSettings();
                    }));
        }
    }
}