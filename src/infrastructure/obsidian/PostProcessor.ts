import { MarkdownPostProcessorContext } from "obsidian";
import { CapsuleSettings, FoldClass } from "../../domain/models/Settings";
import { CapsuleParser } from "../../application/CapsuleParser";
import { CapsuleNode } from "../../domain/models/CapsuleNode";

export function createMarkdownPostProcessor(
    settings: CapsuleSettings,
    expandedCache: Set<string>
) {
    return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
        const parser = new CapsuleParser(settings.classes);
        const blocks = el.querySelectorAll("p, li, span");
        
        blocks.forEach((node: Element) => {
            const block = node as HTMLElement;
            if (!block.innerText) return;

            let hasAnyStart = false;
            for (const c of settings.classes) {
                if (block.innerText.includes(c.startSymbol)) {
                    hasAnyStart = true;
                    break;
                }
            }
            if (!hasAnyStart) return;

            const rawText = block.innerText;
            const rootNodes = parser.parseLine(rawText, 0);
            if (rootNodes.length === 0) return;

            block.empty();
            
            const renderTree = (nodes: CapsuleNode[], parentEl: HTMLElement, textOffset: number, fullText: string) => {
                let lastIndex = 0;

                nodes.forEach(node => {
                    const localFrom = node.from - textOffset;
                    const localTo = node.to - textOffset;

                    if (localFrom > lastIndex) {
                        parentEl.appendChild(document.createTextNode(fullText.substring(lastIndex, localFrom)));
                    }

                    const foldClass = settings.classes.find(c => c.id === node.classId);
                    if (!foldClass) return;

                    const wrapper = document.createElement("span");
                    wrapper.className = `inline-capsule-wrapper theme-${foldClass.styleType}`;
                    
                    const isExpanded = expandedCache.has(node.content);
                    if (isExpanded) wrapper.classList.add("is-expanded");

                    const trigger = document.createElement("span");
                    trigger.className = "inline-capsule-trigger";
                    trigger.innerText = foldClass.triggerText;

                    const contentSpan = document.createElement("span");
                    contentSpan.className = "inline-capsule-content";
                    contentSpan.innerText = node.content;

                    if (isExpanded) {
                        contentSpan.style.display = "inline";
                        trigger.style.display = "none";
                    } else {
                        contentSpan.style.display = "none";
                        trigger.style.display = "inline-block";
                    }

                    wrapper.appendChild(trigger);
                    wrapper.appendChild(contentSpan);

                    // تفعيل محرك الأحداث التفاعلية لوضع القراءة المعتمد على المصفوفات
                    bindPostProcessorEvents(wrapper, node.content, settings, foldClass, expandedCache);

                    parentEl.appendChild(wrapper);
                    lastIndex = localTo;
                });

                if (lastIndex < fullText.length) {
                    parentEl.appendChild(document.createTextNode(fullText.substring(lastIndex)));
                }
            };

            renderTree(rootNodes, block, 0, rawText);
        });
    };
}

function bindPostProcessorEvents(
    wrapper: HTMLElement,
    content: string,
    settings: CapsuleSettings,
    foldClass: FoldClass,
    expandedCache: Set<string>
) {
    const mode = settings.interactionMode;

    if (mode === "click" || mode === "both") {
        wrapper.addEventListener("click", (e) => {
            e.stopPropagation();
            const contentSpan = wrapper.querySelector(".inline-capsule-content") as HTMLElement;
            const triggerSpan = wrapper.querySelector(".inline-capsule-trigger") as HTMLElement;
            
            if (expandedCache.has(content)) {
                expandedCache.delete(content);
                wrapper.classList.remove("is-expanded");
                if (contentSpan && triggerSpan) {
                    contentSpan.style.display = "none";
                    triggerSpan.style.display = "inline-block";
                }
            } else {
                expandedCache.add(content);
                wrapper.classList.add("is-expanded");
                if (contentSpan && triggerSpan) {
                    contentSpan.style.display = "inline";
                    triggerSpan.style.display = "none";
                }
            }
        });
    }

    if (mode === "hover" || mode === "both") {
        wrapper.addEventListener("mouseenter", () => {
            wrapper.classList.add("is-hover-revealed");
            const contentSpan = wrapper.querySelector(".inline-capsule-content") as HTMLElement;
            const triggerSpan = wrapper.querySelector(".inline-capsule-trigger") as HTMLElement;
            if (contentSpan && triggerSpan && !wrapper.classList.contains("is-expanded")) {
                contentSpan.style.display = "inline";
                triggerSpan.style.display = "none";
            }
        });
        wrapper.addEventListener("mouseleave", () => {
            wrapper.classList.remove("is-hover-revealed");
            const contentSpan = wrapper.querySelector(".inline-capsule-content") as HTMLElement;
            const triggerSpan = wrapper.querySelector(".inline-capsule-trigger") as HTMLElement;
            if (contentSpan && triggerSpan && !wrapper.classList.contains("is-expanded")) {
                contentSpan.style.display = "none";
                triggerSpan.style.display = "inline-block";
            }
        });
    }
}