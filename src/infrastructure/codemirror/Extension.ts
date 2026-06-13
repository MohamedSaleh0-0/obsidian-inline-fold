import { Extension, StateField, StateEffect, EditorState, EditorSelection } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { RangeSetBuilder, Prec } from "@codemirror/state";
import { editorLivePreviewField } from "obsidian";
import { CapsuleSettings } from "../../domain/models/Settings";
import { CapsuleParser } from "../../application/CapsuleParser";
import { CapsuleWidget } from "./CapsuleWidget";
import { CapsuleNode } from "../../domain/models/CapsuleNode";

export const updateCapsuleSettingsEffect = StateEffect.define<CapsuleSettings>();
export const toggleSingleCapsuleEffect = StateEffect.define<number>();
export const setHoveredPositionEffect = StateEffect.define<number | null>();

let openAbsolutePositions = new Set<number>();
let hoveredAbsolutePosition: number | null = null;

export function createCapsuleExtension(
    initialSettings: CapsuleSettings,
    expandedCache: Set<string>
): Extension {
    
    let currentSettings = initialSettings;
    let parser = new CapsuleParser(currentSettings.classes);

    const capsuleField = StateField.define<DecorationSet>({
        create(state) {
            if (!state.field(editorLivePreviewField, false)) return Decoration.none;
            return buildDecorations(state, currentSettings, parser, openAbsolutePositions);
        },
        update(decorations, tr) {
            if (!tr.state.field(editorLivePreviewField, false)) return Decoration.none;

            if (tr.docChanged) {
                const shiftedPositions = new Set<number>();
                openAbsolutePositions.forEach(pos => {
                    shiftedPositions.add(tr.changes.mapPos(pos));
                });
                openAbsolutePositions = shiftedPositions;

                if (hoveredAbsolutePosition !== null) {
                    hoveredAbsolutePosition = tr.changes.mapPos(hoveredAbsolutePosition);
                }
            }

            for (let effect of tr.effects) {
                if (effect.is(setHoveredPositionEffect)) {
                    hoveredAbsolutePosition = effect.value;
                    return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions);
                }
                if (effect.is(toggleSingleCapsuleEffect)) {
                    const targetPos = effect.value;
                    if (openAbsolutePositions.has(targetPos)) {
                        openAbsolutePositions.delete(targetPos);
                    } else {
                        openAbsolutePositions.add(targetPos);
                    }
                    return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions);
                }
                if (effect.is(updateCapsuleSettingsEffect)) {
                    currentSettings = effect.value;
                    parser = new CapsuleParser(currentSettings.classes);
                    openAbsolutePositions.clear();
                    hoveredAbsolutePosition = null;
                    return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions);
                }
            }

            if (tr.docChanged || !tr.startState.selection.eq(tr.state.selection)) {
                return buildDecorations(tr.state, currentSettings, parser, openAbsolutePositions);
            }
            return decorations.map(tr.changes);
        },
        provide: field => EditorView.decorations.from(field)
    });

    const selectionFilter = EditorState.transactionFilter.of((tr) => {
        if (!tr.selection || !tr.state.field(editorLivePreviewField, false)) return tr;

        const startHead = tr.startState.selection.main.head;
        let selectionChanged = false;
        
        const newRanges = tr.selection.ranges.map(range => {
            try {
                const line = tr.state.doc.lineAt(range.head);
                const nodes = parser.parseLine(line.text, line.from);

                for (const node of nodes) {
                    if (openAbsolutePositions.has(node.from) || 
                        hoveredAbsolutePosition === node.from ||
                        (startHead > node.from && startHead < node.to)) {
                        continue;
                    }

                    if (currentSettings.linkCursorToExpansion === "atomicOnCollapse" && range.head > node.from && range.head < node.to) {
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
    openPositions: Set<number>
): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const selectionRanges = state.selection.ranges;

    for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        
        let hasAnyStart = false;
        for (const c of settings.classes) {
            if (line.text.includes(c.startSymbol)) {
                hasAnyStart = true;
                break;
            }
        }
        if (!hasAnyStart) continue;

        const rootNodes = parser.parseLine(line.text, line.from);

        const processNode = (node: CapsuleNode) => {
            const foldClass = settings.classes.find(c => c.id === node.classId);
            if (!foldClass) return;

            const isExpanded = openPositions.has(node.from);
            const isHovered = hoveredAbsolutePosition === node.from;

            if (settings.linkCursorToExpansion === "alwaysReveal") {
                let isCursorInside = false;
                for (let range of selectionRanges) {
                    if (range.from <= node.to && range.to >= node.from) {
                        isCursorInside = true;
                        break;
                    }
                }
                if (isCursorInside) return;
            }

            let checkProximity = true;
            if (settings.protectCollapsedBoundaries) {
                checkProximity = isExpanded || isHovered;
            }

            if (checkProximity) {
                let isCursorInside = false;
                for (let range of selectionRanges) {
                    if (range.head >= node.from && range.head <= node.to) {
                        isCursorInside = true;
                        break;
                    }
                }
                if (isCursorInside) return;
            }

            builder.add(
                node.from,
                node.to,
                Decoration.replace({
                    widget: new CapsuleWidget(
                        node.content,
                        settings,
                        foldClass,
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