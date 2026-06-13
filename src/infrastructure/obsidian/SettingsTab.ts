import { PluginSettingTab, App, Setting } from "obsidian";
import InlineCapsulePlugin from "../../main";

export class InlineCapsuleSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: InlineCapsulePlugin) {
        super(app, plugin);
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "Inline Fold - Dynamic Classes Manager" });

        // -------------------------------------------------------------
        // القسم الأول: الإعدادات السلوكية العامة للمحرر
        // -------------------------------------------------------------
        containerEl.createEl("h3", { text: "Global Behavioral Settings" });

        new Setting(containerEl)
            .setName("Interaction Trigger Mode")
            .setDesc("Choose how all folds expand globally (Hover vs Click vs Both).")
            .addDropdown(dropdown => dropdown
                .addOption("click", "Click Only")
                .addOption("hover", "Hover Only")
                .addOption("both", "Dual Mode")
                .setValue(this.plugin.settings.interactionMode)
                .onChange(async (value: string) => {
                    this.plugin.settings.interactionMode = value as "click" | "hover" | "both";
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName("Link Cursor Traversal To Expansion")
            .setDesc("Determine how the keyboard cursor interacts with capsule expansion states.")
            .addDropdown(dropdown => dropdown
                .addOption("atomicOnCollapse", "Atomic Skip on Collapse (Fluent Edit inside Expanded)")
                .addOption("alwaysReveal", "Always Reveal Markdown on Cursor Proximity")
                .setValue(this.plugin.settings.linkCursorToExpansion)
                .onChange(async (value: string) => {
                    this.plugin.settings.linkCursorToExpansion = value as "atomicOnCollapse" | "alwaysReveal";
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl("hr");

        // -------------------------------------------------------------
        // القسم الثاني: إدارة وتوليد الكلاسات والمجموعات الديناميكية
        // -------------------------------------------------------------
        const classesHeader = containerEl.createEl("div", { cls: "inline-fold-classes-header" });
        classesHeader.style.display = "flex";
        classesHeader.style.justifyContent = "space-between";
        classesHeader.style.alignItems = "center";
        classesHeader.style.marginBottom = "15px";

        const classTitle = classesHeader.createEl("h3", { text: "Configured Fold Classes" });
        classTitle.style.margin = "0";

        new Setting(classesHeader)
            .addButton(button => button
                .setButtonText("+ Add New Class")
                .setCta()
                .onClick(async () => {
                    const newId = "class-" + Date.now();
                    this.plugin.settings.classes.push({
                        id: newId,
                        name: `Class (${this.plugin.settings.classes.length + 1})`,
                        startSymbol: "[?",
                        endSymbol: "?]",
                        styleType: "pill",
                        triggerText: "??",
                        customTextColor: "var(--text-normal)",
                        customBgColor: "var(--background-modifier-form-field)",
                        customBorderColor: "var(--background-modifier-border)",
                        customBorderStyle: "solid",
                        customBorderWidth: "1px",
                        customBorderRadius: "12px",
                        customPadding: "2px 6px",
                        customFontSize: "inherit"
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        this.plugin.settings.classes.forEach((foldClass, index) => {
            const classContainer = containerEl.createEl("div", { cls: "fold-class-card" });
            classContainer.style.border = "1px solid var(--background-modifier-border)";
            classContainer.style.borderRadius = "8px";
            classContainer.style.padding = "15px";
            classContainer.style.marginBottom = "15px";
            classContainer.style.backgroundColor = "var(--background-primary-alt)";

            const cardHeader = classContainer.createEl("div");
            cardHeader.style.display = "flex";
            cardHeader.style.justifyContent = "space-between";
            cardHeader.style.alignItems = "center";
            cardHeader.style.marginBottom = "10px";

            cardHeader.createEl("h4", { text: foldClass.name });

            if (this.plugin.settings.classes.length > 1) {
                new Setting(cardHeader)
                    .addButton(btn => btn
                        .setButtonText("Delete Class")
                        .setWarning()
                        .onClick(async () => {
                            this.plugin.settings.classes.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        }));
            }

            new Setting(classContainer)
                .setName("Class Identity Name")
                .setDesc("A label to identify this structural group.")
                .addText(text => text
                    .setValue(foldClass.name)
                    .onChange(async (val) => {
                        foldClass.name = val || "Unnamed Class";
                        await this.plugin.saveSettings();
                    }));

            new Setting(classContainer)
                .setName("Opening Delimiter")
                .setDesc("The distinct characters that open this fold type.")
                .addText(text => text
                    .setValue(foldClass.startSymbol)
                    .onChange(async (val) => {
                        foldClass.startSymbol = val || "[=";
                        await this.plugin.saveSettings();
                    }));

            new Setting(classContainer)
                .setName("Closing Delimiter")
                .setDesc("The distinct characters that terminate this fold type.")
                .addText(text => text
                    .setValue(foldClass.endSymbol)
                    .onChange(async (val) => {
                        foldClass.endSymbol = val || "=]";
                        await this.plugin.saveSettings();
                    }));

            new Setting(classContainer)
                .setName("Collapsed Indicator Text")
                .setDesc("The placeholder displayed when text is hidden inside this class.")
                .addText(text => text
                    .setValue(foldClass.triggerText)
                    .onChange(async (val) => {
                        foldClass.triggerText = val || "..";
                        await this.plugin.saveSettings();
                    }));

            new Setting(classContainer)
                .setName("Visual Theme Layout")
                .setDesc("Pick a layout archetype or choose Custom to unlock fine-grain control styles.")
                .addDropdown(drop => drop
                    .addOption("ghost", "Ghost Inline")
                    .addOption("pill", "Smart Pill")
                    .addOption("bracket", "Bracket Block")
                    .addOption("custom", "Custom Layout (Unlock Micro Panels)")
                    .setValue(foldClass.styleType)
                    .onChange(async (val: string) => {
                        foldClass.styleType = val as "ghost" | "pill" | "bracket" | "custom";
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            if (foldClass.styleType === "custom") {
                const customSection = classContainer.createEl("div", { cls: "custom-styling-panel" });
                customSection.style.paddingLeft = "15px";
                customSection.style.borderLeft = "2px solid var(--interactive-accent)";
                customSection.style.marginTop = "10px";

                new Setting(customSection)
                    .setName("Text Color")
                    .addText(t => t.setValue(foldClass.customTextColor).onChange(async v => { foldClass.customTextColor = v || "inherit"; await this.plugin.saveSettings(); }));

                new Setting(customSection)
                    .setName("Background Color")
                    .addText(t => t.setValue(foldClass.customBgColor).onChange(async v => { foldClass.customBgColor = v || "transparent"; await this.plugin.saveSettings(); }));

                new Setting(customSection)
                    .setName("Border Style")
                    .addDropdown(d => d.addOption("none", "None").addOption("solid", "Solid").addOption("dashed", "Dashed").addOption("dotted", "Dotted").setValue(foldClass.customBorderStyle).onChange(async v => { foldClass.customBorderStyle = v as any; await this.plugin.saveSettings(); }));

                new Setting(customSection)
                    .setName("Border Color")
                    .addText(t => t.setValue(foldClass.customBorderColor).onChange(async v => { foldClass.customBorderColor = v || "transparent"; await this.plugin.saveSettings(); }));

                new Setting(customSection)
                    .setName("Border Radius")
                    .addText(t => t.setValue(foldClass.customBorderRadius).onChange(async v => { foldClass.customBorderRadius = v || "0px"; await this.plugin.saveSettings(); }));

                new Setting(customSection)
                    .setName("Custom Padding")
                    .addText(t => t.setValue(foldClass.customPadding).onChange(async v => { foldClass.customPadding = v || "0px"; await this.plugin.saveSettings(); }));

                new Setting(customSection)
                    .setName("Font Size")
                    .addText(t => t.setValue(foldClass.customFontSize).onChange(async v => { foldClass.customFontSize = v || "inherit"; await this.plugin.saveSettings(); }));
            }
        });
    }
}