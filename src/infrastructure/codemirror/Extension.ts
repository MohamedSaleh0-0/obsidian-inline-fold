import { Extension, StateField, StateEffect, EditorState, EditorSelection } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, Prec } from "@codemirror/state";
import { CapsuleSettings } from "../../domain/models/Settings";
import { CapsuleParser } from "../../application/CapsuleParser";
import { CapsuleWidget } from "./CapsuleWidget";
import { CapsuleNode } from "../../domain/models/CapsuleNode";

export const updateCapsuleSettingsEffect = StateEffect.define<CapsuleSettings>();
export const toggleSingleCapsuleEffect = StateEffect.define<number>();
export const startEditCapsuleEffect = StateEffect.define<number>();

let openAbsolutePositions = new Set<number>();
let activeEditPosition: number | null = null;

export function createCapsuleExtension(
    initialSettings: CapsuleSettings,
    expandedCache: Set<string>
): Extension {
    
    let currentSettings = initialSettings;
    let parser = new CapsuleParser(currentSettings.startSymbol, currentSettings.endSymbol);

    const capsuleField = StateField.define<DecorationSet>({
        create(state) {
            return buildDecorations(state, currentSettings, parser, openAbsolutePositions, activeEditPosition);
        },
        update(decorations, tr) {
            // زحزحة المواقع برمجياً عند الكتابة لمنع انزلاق المؤشرات
            if (tr.docChanged) {
                const shiftedPositions = new Set<number>();
                openAbsolutePositions.forEach(pos => {
                    shiftedPositions.add(tr.changes.mapPos(pos));
                });
                openAbsolutePositions = shiftedPositions;

                if (activeEditPosition !== null) {
                    activeEditPosition = tr.changes.mapPos(activeEditPosition);
                }
            }

            for (let effect of tr.effects) {
                if (effect.is(toggleSingleCapsuleEffect)) {
                    const targetPos = effect.value;
                    if (openAbsolutePositions.has(targetPos)) {
                        openAbsolutePositions.delete(targetPos);
                    } else {
                        openAbsolutePositions.add(targetPos);
                    }
                    return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions, activeEditPosition);
                }
                if (effect.is(startEditCapsuleEffect)) {
                    activeEditPosition = effect.value;
                    return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions, activeEditPosition);
                }
                if (effect.is(updateCapsuleSettingsEffect)) {
                    currentSettings = effect.value;
                    parser = new CapsuleParser(currentSettings.startSymbol, currentSettings.endSymbol);
                    openAbsolutePositions.clear();
                    activeEditPosition = null;
                    return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions, activeEditPosition);
                }
            }

            // فحص الخروج التلقائي الصارم: إذا تحرك المؤشر خارج حدود الكبسولة الحالية، نغلق الماركداون فوراً
            if (activeEditPosition !== null) {
                const head = tr.state.selection.main.head;
                try {
                    const line = tr.state.doc.lineAt(activeEditPosition);
                    const nodes = parser.parseLine(line.text, line.from);
                    let stillInside = false;

                    for (const node of nodes) {
                        if (node.from === activeEditPosition) {
                            if (head >= node.from && head <= node.to) {
                                stillInside = true;
                            }
                            break;
                        }
                    }

                    if (!stillInside) {
                        activeEditPosition = null;
                    }
                } catch (e) {
                    activeEditPosition = null;
                }
            }

            if (tr.docChanged || !tr.startState.selection.eq(tr.state.selection)) {
                return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions, activeEditPosition);
            }
            return decorations.map(tr.changes);
        },
        provide: field => EditorView.decorations.from(field)
    });

    const selectionFilter = EditorState.transactionFilter.of((tr) => {
        if (!tr.selection) return tr;

        const startHead = tr.startState.selection.main.head;
        let selectionChanged = false;
        
        const newRanges = tr.selection.ranges.map(range => {
            try {
                const line = tr.state.doc.lineAt(range.head);
                const nodes = parser.parseLine(line.text, line.from);

                for (const node of nodes) {
                    // إذا كانت الكبسولة قيد التعديل النشط الصريح، نعطي الحصانة للمؤشر للتحرك بحرية داخل الحروف
                    if (openAbsolutePositions.has(node.from) || activeEditPosition === node.from) continue;

                    if (currentSettings.cursorBehavior === "bypass" && range.head > node.from && range.head < node.to) {
                        selectionChanged = true;
                        if (startHead <= node.from) {
                            return EditorSelection.cursor(node.to);
                        } else if (startHead >= node.to) {
                            return EditorSelection.cursor(node.from);
                        } else {
                            return range.head - node.from > node.to - range.head 
                                ? EditorSelection.cursor(node.to) 
                                : EditorSelection.cursor(node.from);
                        }
                    }
                }
            } catch (e) {}
            return range;
        });

        if (selectionChanged) {
            return [tr, { selection: EditorSelection.create(newRanges) }];
        }
        return tr;
    });

    return [Prec.highest(capsuleField), selectionFilter];
}

function buildDecorations(
    state: any,
    settings: CapsuleSettings,
    parser: CapsuleParser,
    openPositions: Set<number>,
    editPos: number | null
): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selectionRanges = state.selection.ranges;
    const startSym = settings.startSymbol;

    for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        if (!line.text.includes(startSym)) continue;

        const rootNodes = parser.parseLine(line.text, line.from);

        const processNode = (node: CapsuleNode) => {
            // حصانة التعديل الصريح: إذا كانت الكبسولة يتم تعديلها الآن، نسقط الديكور تماماً لتظهر كـ Markdown أصلي
            if (editPos === node.from) {
                node.children.forEach(processNode);
                return;
            }

            if (settings.cursorBehavior === "reveal") {
                let isCursorInside = false;
                for (let range of selectionRanges) {
                    if (range.from <= node.to && range.to >= node.from) {
                        isCursorInside = true;
                        break;
                    }
                }
                if (isCursorInside) {
                    node.children.forEach(processNode);
                    return;
                }
            }

            const isExpanded = openPositions.has(node.from);

            builder.add(
                node.from,
                node.to,
                Decoration.replace({
                    widget: new CapsuleWidget(
                        node.content,
                        settings,
                        isExpanded,
                        node.from
                    )
                })
            );
        };

        rootNodes.forEach(processNode);
    }

    return builder.finish();
}