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
                    wrapper.style.cursor = "pointer";
                    wrapper.style.display = "inline-block";
                    
                    const isExpanded = expandedCache.has(node.content);
                    if (isExpanded) wrapper.classList.add("is-expanded");

                    const trigger = document.createElement("span");
                    trigger.className = "inline-capsule-trigger";
                    
                    const finalTriggerText = node.alias !== undefined ? node.alias : foldClass.triggerText;
                    trigger.innerText = finalTriggerText;
                    trigger.style.cursor = "pointer";

                    const contentSpan = document.createElement("span");
                    contentSpan.className = "inline-capsule-content";
                    contentSpan.innerText = node.content;
                    contentSpan.style.cursor = "pointer";

                    if (isExpanded) {
                        contentSpan.style.display = "inline";
                        trigger.style.display = "none";
                    } else {
                        contentSpan.style.display = "none";
                        trigger.style.display = "inline-block";
                    }

                    const type = foldClass.styleType;
                    if (type === "ghost") {
                        if (isExpanded) {
                            wrapper.style.backgroundColor = "var(--background-modifier-form-field)";
                            wrapper.style.padding = "2px 6px";
                            wrapper.style.borderRadius = "4px";
                            contentSpan.style.color = "var(--text-normal)";
                        } else {
                            wrapper.style.backgroundColor = "transparent";
                            wrapper.style.padding = "0px";
                            trigger.style.color = "var(--text-muted)";
                            trigger.style.fontWeight = "600";
                            trigger.style.opacity = "0.8";
                        }
                    } else if (type === "pill") {
                        wrapper.style.backgroundColor = "var(--background-modifier-form-field)";
                        wrapper.style.border = "1px solid var(--background-modifier-border)";
                        wrapper.style.borderRadius = "12px";
                        wrapper.style.padding = "2px 8px";
                        trigger.style.color = "var(--text-normal)";
                        trigger.style.fontSize = "0.9em";
                        contentSpan.style.color = "var(--text-accent)";
                    } else if (type === "bracket") {
                        wrapper.style.backgroundColor = "transparent";
                        wrapper.style.padding = "0px";
                        wrapper.style.border = "none";
                        trigger.style.color = "var(--text-warning)";
                        trigger.style.fontFamily = "var(--font-monospace)";
                        trigger.innerText = `[${finalTriggerText}]`;
                        contentSpan.style.fontFamily = "var(--font-monospace)";
                        contentSpan.style.color = "var(--text-success)";
                    } else if (type === "custom") {
                        wrapper.style.color = foldClass.customTextColor;
                        wrapper.style.backgroundColor = foldClass.customBgColor;
                        wrapper.style.borderColor = foldClass.customBorderColor;
                        wrapper.style.borderStyle = foldClass.customBorderStyle;
                        wrapper.style.borderWidth = foldClass.customBorderWidth;
                        wrapper.style.borderRadius = foldClass.customBorderRadius;
                        wrapper.style.padding = foldClass.customPadding;
                        wrapper.style.fontSize = foldClass.customFontSize;
                    }

                    wrapper.appendChild(trigger);
                    wrapper.appendChild(contentSpan);

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
    const type = foldClass.styleType;

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
                    if (type === "ghost") {
                        wrapper.style.backgroundColor = "transparent";
                        wrapper.style.padding = "0px";
                    }
                }
            } else {
                expandedCache.add(content);
                wrapper.classList.add("is-expanded");
                if (contentSpan && triggerSpan) {
                    contentSpan.style.display = "inline";
                    triggerSpan.style.display = "none";
                    if (type === "ghost") {
                        wrapper.style.backgroundColor = "var(--background-modifier-form-field)";
                        wrapper.style.padding = "2px 6px";
                        wrapper.style.borderRadius = "4px";
                    }
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
                if (type === "ghost") {
                    wrapper.style.backgroundColor = "var(--background-modifier-form-field)";
                    wrapper.style.padding = "2px 6px";
                    wrapper.style.borderRadius = "4px";
                }
            }
        });
        wrapper.addEventListener("mouseleave", () => {
            wrapper.classList.remove("is-hover-revealed");
            const contentSpan = wrapper.querySelector(".inline-capsule-content") as HTMLElement;
            const triggerSpan = wrapper.querySelector(".inline-capsule-trigger") as HTMLElement;
            if (contentSpan && triggerSpan && !wrapper.classList.contains("is-expanded")) {
                contentSpan.style.display = "none";
                triggerSpan.style.display = "inline-block";
                if (type === "ghost") {
                    wrapper.style.backgroundColor = "transparent";
                    wrapper.style.padding = "0px";
                }
            }
        });
    }
}