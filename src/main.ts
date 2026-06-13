import { Plugin } from "obsidian";
import { CapsuleSettings, DEFAULT_SETTINGS, FoldClass } from "./domain/models/Settings";
import { createCapsuleExtension, updateCapsuleSettingsEffect, toggleSingleCapsuleEffect } from "./infrastructure/codemirror/Extension";
import { createMarkdownPostProcessor } from "./infrastructure/obsidian/PostProcessor";
import { InlineCapsuleSettingTab } from "./infrastructure/obsidian/SettingsTab";
import { CapsuleParser } from "./application/CapsuleParser";

export default class InlineCapsulePlugin extends Plugin {
    settings: CapsuleSettings = DEFAULT_SETTINGS;
    expandedCache: Set<string> = new Set();
    private registeredCommandIds: string[] = [];

    async onload() {
        await this.loadSettings();

        this.registerEditorExtension(createCapsuleExtension(this.settings, this.expandedCache));
        this.registerMarkdownPostProcessor(createMarkdownPostProcessor(this.settings, this.expandedCache));
        this.addSettingTab(new InlineCapsuleSettingTab(this.app, this));

        this.refreshPluginCommands();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        
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

        this.refreshPluginCommands();
    }

    refreshPluginCommands() {
        const appCommands = (this.app as any).commands;
        if (appCommands && this.registeredCommandIds.length > 0) {
            this.registeredCommandIds.forEach(cmdId => {
                if (appCommands.commands[cmdId]) {
                    appCommands.removeCommand(cmdId);
                }
            });
            this.registeredCommandIds = [];
        }

        const parser = new CapsuleParser(this.settings.classes);

        // أولاً: الأوامر التبديلية الهيكلية المخصصة لكل فئة (Encapsulate / Decapsulate)
        this.settings.classes.forEach((foldClass: FoldClass) => {
            const commandId = `inline-fold-toggle-${foldClass.id}`;
            const commandName = `Toggle Encapsulation: ${foldClass.name}`;

            this.addCommand({
                id: commandId,
                name: commandName,
                editorCallback: (editor) => {
                    const startSym = foldClass.startSymbol;
                    const endSym = foldClass.endSymbol;
                    
                    const cursor = editor.getCursor();
                    const currentLineText = editor.getLine(cursor.line);
                    
                    let lineOffset = 0;
                    for (let l = 0; l < cursor.line; l++) {
                        lineOffset += editor.getLine(l).length + 1;
                    }
                    const absoluteCursorPos = lineOffset + cursor.ch;

                    const parsedNodes = parser.parseLine(currentLineText, lineOffset);
                    let targetNode = null;

                    for (const node of parsedNodes) {
                        if (absoluteCursorPos >= node.from && absoluteCursorPos <= node.to) {
                            targetNode = node;
                            break;
                        }
                    }

                    if (targetNode) {
                        const localFrom = targetNode.from - lineOffset;
                        const localTo = targetNode.to - lineOffset;
                        const originalContent = targetNode.content;
                        
                        editor.replaceRange(
                            originalContent,
                            { line: cursor.line, ch: localFrom },
                            { line: cursor.line, ch: localTo }
                        );
                        
                        editor.setCursor({ line: cursor.line, ch: localFrom });
                        return;
                    }

                    if (editor.somethingSelected()) {
                        const selectedText = editor.getSelection();
                        
                        if (selectedText.startsWith(startSym) && selectedText.endsWith(endSym)) {
                            const cleaned = selectedText.substring(startSym.length, selectedText.length - endSym.length);
                            editor.replaceSelection(cleaned);
                        } else {
                            editor.replaceSelection(`${startSym}${selectedText}${endSym}`);
                        }
                    } else {
                        editor.replaceSelection(`${startSym}${endSym}`);
                        editor.setCursor({
                            line: cursor.line,
                            ch: cursor.ch + startSym.length
                        });
                    }
                }
            });

            this.registeredCommandIds.push(`${this.manifest.id}:${commandId}`);
        });

        // ثانياً: الأمر الموحد الجديد كلياً لتبديل حالة عرض السطر الحالي بالكامل (Toggle Line Expansion)
        const lineCommandId = "inline-fold-toggle-current-line";
        const lineCommandName = "Toggle Expansion on Current Line";

        this.addCommand({
            id: lineCommandId,
            name: lineCommandName,
            editorCallback: (editor) => {
                const cmInstance = (editor as any).cm;
                if (!cmInstance) return;

                const cursor = editor.getCursor();
                const currentLineText = editor.getLine(cursor.line);
                
                let lineOffset = 0;
                for (let l = 0; l < cursor.line; l++) {
                    lineOffset += editor.getLine(l).length + 1;
                }

                const parsedNodes = parser.parseLine(currentLineText, lineOffset);
                if (parsedNodes.length === 0) return;

                parsedNodes.forEach(node => {
                    cmInstance.dispatch({
                        effects: toggleSingleCapsuleEffect.of(node.from)
                    });
                });
            }
        });

        this.registeredCommandIds.push(`${this.manifest.id}:${lineCommandId}`);
    }
}