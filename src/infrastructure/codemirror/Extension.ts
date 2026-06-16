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

let openAbsolutePositions = new Set<number>();
export let hoveredAbsolutePosition: number | null = null;

export function setHoveredPosition(pos: number | null) {
    hoveredAbsolutePosition = pos;
}

export function createCapsuleExtension(
    initialSettings: CapsuleSettings,
    expandedCache: Set<string>
): Extension {
    
    let currentSettings = initialSettings;
    let parser = new CapsuleParser(currentSettings.classes);

    function harvestNodes(state: EditorState): CapsuleNode[] {
        const nodes: CapsuleNode[] = [];
        for (let i = 1; i <= state.doc.lines; i++) {
            const line = state.doc.line(i);
            let hasAnyStart = false;
            for (const c of currentSettings.classes) {
                if (line.text.includes(c.startSymbol)) {
                    hasAnyStart = true;
                    break;
                }
            }
            if (!hasAnyStart) continue;
            try {
                const lineNodes = parser.parseLine(line.text, line.from);
                nodes.push(...lineNodes);
            } catch (e) {}
        }
        return nodes;
    }

    function buildDecorationsFromCache(
        state: EditorState,
        nodes: CapsuleNode[],
        openPositions: Set<number>
    ): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const selectionRanges = state.selection.ranges;

        for (const node of nodes) {
            const foldClass = currentSettings.classes.find(c => c.id === node.classId);
            if (!foldClass) continue;

            const isExpanded = openPositions.has(node.from);
            const isHovered = hoveredAbsolutePosition === node.from;

            let skipDecoration = false;

            for (let range of selectionRanges) {
                if (range.head > node.from && range.head < node.to) {
                    skipDecoration = true;
                    break;
                }
                
                if (range.head === node.from || range.head === node.to) {
                    if (!currentSettings.protectCollapsedBoundaries || isExpanded || isHovered) {
                        skipDecoration = true;
                        break;
                    }
                }
            }

            if (currentSettings.linkCursorToExpansion === "alwaysReveal") {
                for (let range of selectionRanges) {
                    if (range.from <= node.to && range.to >= node.from) {
                        skipDecoration = true;
                        break;
                    }
                }
            }

            if (skipDecoration) continue;

            builder.add(
                node.from,
                node.to,
                Decoration.replace({
                    widget: new CapsuleWidget(
                        node.content,
                        currentSettings,
                        foldClass,
                        isExpanded,
                        node.from,
                        node.alias
                    )
                })
            );
        }

        return builder.finish();
    }

    const capsuleField = StateField.define<{ decorations: DecorationSet; nodes: CapsuleNode[] }>({
        create(state) {
            if (!state.field(editorLivePreviewField, false)) {
                return { decorations: Decoration.none, nodes: [] };
            }
            const nodes = harvestNodes(state);
            const decorations = buildDecorationsFromCache(state, nodes, openAbsolutePositions);
            return { decorations, nodes };
        },
        update(value, tr) {
            if (!tr.state.field(editorLivePreviewField, false)) {
                return { decorations: Decoration.none, nodes: [] };
            }

            let nodes = value.nodes;
            let forceRebuild = false;

            if (tr.docChanged) {
                nodes = harvestNodes(tr.state);
                forceRebuild = true;

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
                if (effect.is(toggleSingleCapsuleEffect)) {
                    const targetPos = effect.value;
                    if (openAbsolutePositions.has(targetPos)) {
                        openAbsolutePositions.delete(targetPos);
                    } else {
                        openAbsolutePositions.add(targetPos);
                    }
                    forceRebuild = true;
                }
                if (effect.is(updateCapsuleSettingsEffect)) {
                    currentSettings = effect.value;
                    parser = new CapsuleParser(currentSettings.classes);
                    openAbsolutePositions.clear();
                    hoveredAbsolutePosition = null;
                    nodes = harvestNodes(tr.state);
                    forceRebuild = true;
                }
            }

            if (forceRebuild || !tr.startState.selection.eq(tr.state.selection)) {
                const decorations = buildDecorationsFromCache(tr.state, nodes, openAbsolutePositions);
                return { decorations, nodes };
            }

            return { decorations: value.decorations.map(tr.changes), nodes };
        },
        provide: field => EditorView.decorations.from(field, value => value.decorations)
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
                        node.content === "" || // تجاوز فلتر الحجب فوراً إذا كانت الكبسولة فارغة تماماً أثناء توليدها
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