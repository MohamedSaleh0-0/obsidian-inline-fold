import { FoldClass } from "../domain/models/Settings";
import { CapsuleNode } from "../domain/models/CapsuleNode";

interface OpenTag {
    foldClass: FoldClass;
    index: number;
}

export class CapsuleParser {
    constructor(private classes: FoldClass[]) {}

    parseLine(text: string, lineFrom: number): CapsuleNode[] {
        const roots: CapsuleNode[] = [];
        const stack: OpenTag[] = [];
        let i = 0;

        while (i < text.length) {
            if (stack.length > 0) {
                const activeTag = stack[stack.length - 1];
                const endSym = activeTag.foldClass.endSymbol;
                
                if (text.startsWith(endSym, i)) {
                    const openTag = stack.pop()!;
                    const nodeFrom = lineFrom + openTag.index;
                    const nodeTo = lineFrom + i + endSym.length;
                    
                    const contentFrom = openTag.index + openTag.foldClass.startSymbol.length;
                    const fullRawContent = text.substring(contentFrom, i);

                    // ميكانيزم فحص وفصل الاسم المستعار (Alias Processing)
                    let finalContent = fullRawContent;
                    let aliasText: string | undefined = undefined;

                    const pipeIndex = fullRawContent.indexOf("|");
                    if (pipeIndex !== -1) {
                        finalContent = fullRawContent.substring(0, pipeIndex);
                        aliasText = fullRawContent.substring(pipeIndex + 1);
                    }

                    const node: CapsuleNode = {
                        from: nodeFrom,
                        to: nodeTo,
                        content: finalContent,
                        classId: openTag.foldClass.id,
                        alias: aliasText,
                        children: []
                    };

                    roots.push(node);
                    i += endSym.length;
                    continue;
                }
            }

            let matchedStart = false;
            for (const foldClass of this.classes) {
                if (text.startsWith(foldClass.startSymbol, i)) {
                    stack.push({ foldClass, index: i });
                    i += foldClass.startSymbol.length;
                    matchedStart = true;
                    break;
                }
            }

            if (!matchedStart) {
                i++;
            }
        }

        return this.filterRootNodes(roots);
    }

    private filterRootNodes(nodes: CapsuleNode[]): CapsuleNode[] {
        nodes.sort((a, b) => a.from - b.from || b.to - a.to);
        const roots: CapsuleNode[] = [];
        let lastTo = -1;

        for (const node of nodes) {
            if (node.from >= lastTo) {
                roots.push(node);
                lastTo = node.to;
            }
        }
        return roots;
    }
}