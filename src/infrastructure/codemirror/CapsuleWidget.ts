import { WidgetType, EditorView } from "@codemirror/view";
import { CapsuleSettings, FoldClass } from "../../domain/models/Settings";
import { toggleSingleCapsuleEffect, setHoveredPosition } from "./Extension";

export class CapsuleWidget extends WidgetType {
    private leaveTimeout: any = null;

    constructor(
        private readonly content: string,
        private readonly globalSettings: CapsuleSettings,
        private readonly foldClass: FoldClass,
        private readonly isExpanded: boolean,
        private readonly absoluteFrom: number,
        private readonly customAlias?: string
    ) {
        super();
    }

    eq(other: CapsuleWidget): boolean {
        return other.content === this.content && 
               other.isExpanded === this.isExpanded && 
               other.absoluteFrom === this.absoluteFrom &&
               other.customAlias === this.customAlias &&
               JSON.stringify(other.foldClass) === JSON.stringify(this.foldClass) &&
               other.globalSettings.interactionMode === this.globalSettings.interactionMode &&
               other.globalSettings.linkCursorToExpansion === this.globalSettings.linkCursorToExpansion &&
               other.globalSettings.protectCollapsedBoundaries === this.globalSettings.protectCollapsedBoundaries &&
               other.globalSettings.hoverCollapseDelay === this.globalSettings.hoverCollapseDelay;
    }

    toDOM(view: EditorView): HTMLElement {
        const wrapper = document.createElement("span");
        wrapper.className = `inline-capsule-wrapper theme-${this.foldClass.styleType}`;
        wrapper.style.cursor = "pointer";
        wrapper.style.display = "inline-block"; // تضمن الحفاظ على أبعاد البوكس موديل أثناء التبديل

        const trigger = document.createElement("span");
        trigger.className = "inline-capsule-trigger";
        
        const finalTriggerText = this.customAlias !== undefined ? this.customAlias : this.foldClass.triggerText;
        trigger.innerText = finalTriggerText;
        trigger.style.cursor = "pointer";

        const contentSpan = document.createElement("span");
        contentSpan.className = "inline-capsule-content";
        contentSpan.innerText = this.content;
        contentSpan.style.cursor = "pointer";

        if (this.isExpanded) {
            wrapper.classList.add("is-expanded");
            contentSpan.style.display = "inline";
            trigger.style.display = "none";
        } else {
            contentSpan.style.display = "none";
            trigger.style.display = "inline-block";
        }

        const type = this.foldClass.styleType;
        if (type === "ghost") {
            if (this.isExpanded) {
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
            // حل المشكلة بصورة جذرية: حقن خصائص لوحة التحكم المخصصة مباشرة على الحاوية الخارجية الكبرى
            wrapper.style.color = this.foldClass.customTextColor;
            wrapper.style.backgroundColor = this.foldClass.customBgColor;
            wrapper.style.borderColor = this.foldClass.customBorderColor;
            wrapper.style.borderStyle = this.foldClass.customBorderStyle;
            wrapper.style.borderWidth = this.foldClass.customBorderWidth;
            wrapper.style.borderRadius = this.foldClass.customBorderRadius;
            wrapper.style.padding = this.foldClass.customPadding;
            wrapper.style.fontSize = this.foldClass.customFontSize;
        }

        wrapper.appendChild(trigger);
        wrapper.appendChild(contentSpan);

        this.bindEvents(wrapper, trigger, contentSpan, view);
        return wrapper;
    }

    private bindEvents(wrapper: HTMLElement, trigger: HTMLElement, contentSpan: HTMLElement, view: EditorView): void {
        const mode = this.globalSettings.interactionMode;
        const type = this.foldClass.styleType;

        wrapper.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (mode === "click" || mode === "both") {
                view.dispatch({
                    effects: toggleSingleCapsuleEffect.of(this.absoluteFrom)
                });
            }
        });

        if (mode === "hover" || mode === "both") {
            wrapper.addEventListener("mouseenter", () => {
                if (this.leaveTimeout) {
                    clearTimeout(this.leaveTimeout);
                    this.leaveTimeout = null;
                }

                wrapper.classList.add("is-hover-revealed");
                setHoveredPosition(this.absoluteFrom);

                if (!this.isExpanded) {
                    contentSpan.style.display = "inline";
                    trigger.style.display = "none";

                    if (type === "ghost") {
                        wrapper.style.backgroundColor = "var(--background-modifier-form-field)";
                        wrapper.style.padding = "2px 6px";
                        wrapper.style.borderRadius = "4px";
                        contentSpan.style.color = "var(--text-normal)";
                    }
                }
            });

            wrapper.addEventListener("mouseleave", () => {
                const delay = this.globalSettings.hoverCollapseDelay;

                const executeLeave = () => {
                    wrapper.classList.remove("is-hover-revealed");
                    setHoveredPosition(null);

                    if (!this.isExpanded) {
                        contentSpan.style.display = "none";
                        trigger.style.display = "inline-block";

                        if (type === "ghost") {
                            wrapper.style.backgroundColor = "transparent";
                            wrapper.style.padding = "0px";
                            trigger.style.color = "var(--text-muted)";
                            trigger.style.opacity = "0.8";
                        }
                    }
                };

                if (delay > 0) {
                    this.leaveTimeout = setTimeout(executeLeave, delay);
                } else {
                    executeLeave();
                }
            });
        }
    }

    ignoreEvent(): boolean {
        return true;
    }
}