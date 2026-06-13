import { Plugin } from "obsidian";
import { CapsuleSettings, DEFAULT_SETTINGS, FoldClass } from "./domain/models/Settings";
import { createCapsuleExtension, updateCapsuleSettingsEffect } from "./infrastructure/codemirror/Extension";
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

        // توليد الأوامر التبديلية المخصصة لكل فئة فور إقلاع الإضافة
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

        // تحديث وإعادة بناء الأوامر فوراً إذا قام المستخدم بإضافة أو حذف فئة من الإعدادات
        this.refreshPluginCommands();
    }

    /**
     * محرك توليد الأوامر التبديلية الديناميكية لكل فئة (Toggle Encapsulation Command Engine)
     */
    refreshPluginCommands() {
        // 1. تنظيف الأوامر القديمة المسجلة في ذاكرة أوبسيديان لتفادي التكرار
        const appCommands = (this.app as any).commands;
        if (appCommands && this.registeredCommandIds.length > 0) {
            this.registeredCommandIds.forEach(cmdId => {
                if (appCommands.commands[cmdId]) {
                    appCommands.removeCommand(cmdId);
                }
            });
            this.registeredCommandIds = [];
        }

        // 2. بناء أمر تبديلي ذكي (Toggle) لكل فئة متاحة حالياً في المصفوفة
        const parser = new CapsuleParser(this.settings.classes);

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
                    
                    // تحويل إحداثيات المحرر الموضعية إلى إحداثيات خطية فريدة يفهمها الـ Parser
                    let lineOffset = 0;
                    for (let l = 0; l < cursor.line; l++) {
                        lineOffset += editor.getLine(l).length + 1; // +1 لتعويض فاصل السطر \n
                    }
                    const absoluteCursorPos = lineOffset + cursor.ch;

                    // فحص ما إذا كان المؤشر يقع حالياً داخل فئة مغلفة بالفعل
                    const parsedNodes = parser.parseLine(currentLineText, lineOffset);
                    let targetNode = null;

                    for (const node of parsedNodes) {
                        if (absoluteCursorPos >= node.from && absoluteCursorPos <= node.to) {
                            targetNode = node;
                            break;
                        }
                    }

                    // السيناريو أ: المؤشر يقع داخل كبسولة بالفعل -> نقوم بـ "فك التغليف التلقائي" (Decapsulate)
                    if (targetNode) {
                        const localFrom = targetNode.from - lineOffset;
                        const localTo = targetNode.to - lineOffset;
                        
                        // استخراج النص الأصلي المعزول بدون الرموز
                        const originalContent = targetNode.content;
                        
                        editor.replaceRange(
                            originalContent,
                            { line: cursor.line, ch: localFrom },
                            { line: cursor.line, ch: localTo }
                        );
                        
                        // إعادة تموضع المؤشر بذكاء عند بداية النص المفكوك
                        editor.setCursor({ line: cursor.line, ch: localFrom });
                        return;
                    }

                    // السيناريو ب: المؤشر في مساحة حرة -> نقوم بالتغليف العادي تتبعاً لحالة التحديد (Encapsulate)
                    if (editor.somethingSelected()) {
                        const selectedText = editor.getSelection();
                        
                        // إذا كان النص المحدد مغلفاً بالفعل بنفس الرموز بشكل صريح، نقوم بفكه أيضاً كـ Toggle
                        if (selectedText.startsWith(startSym) && selectedText.endsWith(endSym)) {
                            const cleaned = selectedText.substring(startSym.length, selectedText.length - endSym.length);
                            editor.replaceSelection(cleaned);
                        } else {
                            editor.replaceSelection(`${startSym}${selectedText}${endSym}`);
                        }
                    } else {
                        // إذا لم يكن هناك تحديد، نضع رموزاً فارغة ونرمي المؤشر في المنتصف مباشرة لبدء الكتابة
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
    }
}