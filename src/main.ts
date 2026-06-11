import { Plugin } from "obsidian";
import { CapsuleSettings, DEFAULT_SETTINGS } from "./domain/models/Settings";
import { createCapsuleExtension, updateCapsuleSettingsEffect } from "./infrastructure/codemirror/Extension";
import { createMarkdownPostProcessor } from "./infrastructure/obsidian/PostProcessor";
import { InlineCapsuleSettingTab } from "./infrastructure/obsidian/SettingsTab";

export default class InlineCapsulePlugin extends Plugin {
    settings: CapsuleSettings = DEFAULT_SETTINGS;
    expandedCache: Set<string> = new Set();

    async onload() {
        await this.loadSettings();

        this.registerEditorExtension(createCapsuleExtension(this.settings, this.expandedCache));
        this.registerMarkdownPostProcessor(createMarkdownPostProcessor(this.settings, this.expandedCache));
        this.addSettingTab(new InlineCapsuleSettingTab(this.app, this));

        this.addCommand({
            id: "wrap-inline-capsule-selection",
            name: "Encapsulate Selected Text",
            editorCallback: (editor) => {
                const start = this.settings.startSymbol;
                const end = this.settings.endSymbol;

                if (editor.somethingSelected()) {
                    const selectedText = editor.getSelection();
                    editor.replaceSelection(`${start}${selectedText}${end}`);
                } else {
                    const cursor = editor.getCursor();
                    editor.replaceSelection(`${start}${end}`);
                    editor.setCursor({
                        line: cursor.line,
                        ch: cursor.ch + start.length
                    });
                }
            }
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
        // الإصلاح المرجعي: تمرير كائن مستنسخ كلياً لتفادي جمود الكاش في دالة المقارنة الرسومية
        const clonedSettings = { ...this.settings };
        
        this.app.workspace.iterateAllLeaves((leaf) => {
            if (leaf.view.getViewType() === "markdown") {
                const markdownView = leaf.view as any;
                if (markdownView.editor && markdownView.editor.cm) {
                    markdownView.editor.cm.dispatch({
                        effects: updateCapsuleSettingsEffect.of(clonedSettings)
                    });
                }
            }
        });
    }
}