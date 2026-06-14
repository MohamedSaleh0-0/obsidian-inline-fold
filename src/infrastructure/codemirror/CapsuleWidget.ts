import { WidgetType, EditorView } from "@codemirror/view";
import { CapsuleSettings, FoldClass } from "../../domain/models/Settings";
import { toggleSingleCapsuleEffect, setHoveredPositionEffect } from "./Extension";

export class CapsuleWidget extends WidgetType {
    private leaveTimeout: any = null;

    constructor(
        private readonly content: string,
        private readonly globalSettings: CapsuleSettings,
        private readonly foldClass: FoldClass,
        private readonly isExpanded: boolean,
        private readonly absoluteFrom: number
    ) {
        super();
    }

    eq(other: CapsuleWidget): boolean {
        return other.content === this.content && 
               other.isExpanded === this.isExpanded && 
               other.absoluteFrom === this.absoluteFrom &&
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

        const trigger = document.createElement("span");
        trigger.className = "inline-capsule-trigger";
        trigger.innerText = this.foldClass.triggerText;
        trigger.style.cursor = "pointer";

        const contentSpan = document.createElement("span");
        contentSpan.className = "inline-capsule-content";
        contentSpan.innerText = this.content;
        contentSpan.style.cursor = "pointer";

        // فرض التحكم الهيكلي للعرض والإخفاء
        if (this.isExpanded) {
            wrapper.classList.add("is-expanded");
            contentSpan.style.display = "inline";
            trigger.style.display = "none";
        } else {
            contentSpan.style.display = "none";
            trigger.style.display = "inline-block";
        }

        // حقن التنسيقات الرسومية الخاصة بكل ثيم برمجياً لقطع الشك بالـ CSS
        const type = this.foldClass.styleType;
        if (type === "ghost") {
            trigger.style.color = "var(--text-muted)";
            trigger.style.fontWeight = "600";
            trigger.style.opacity = "0.8";

            contentSpan.style.color = "var(--text-normal)";
            contentSpan.style.backgroundColor = "var(--background-modifier-form-field)";
            contentSpan.style.padding = "2px 6px";
            contentSpan.style.borderRadius = "4px";
        } else if (type === "pill") {
            trigger.style.backgroundColor = "var(--background-modifier-border)";
            trigger.style.color = "var(--text-normal)";
            trigger.style.padding = "1px 6px";
            trigger.style.borderRadius = "12px";
            trigger.style.fontSize = "0.85em";
            trigger.style.border = "1px solid var(--background-modifier-border-hover)";

            contentSpan.style.backgroundColor = "var(--background-primary-alt)";
            contentSpan.style.color = "var(--text-accent)";
            contentSpan.style.padding = "2px 6px";
            contentSpan.style.borderRadius = "4px";
            contentSpan.style.border = "1px solid var(--background-modifier-border)";
        } else if (type === "bracket") {
            trigger.style.color = "var(--text-warning)";
            trigger.style.fontFamily = "var(--font-monospace)";
            trigger.innerText = `[${this.foldClass.triggerText}]`;

            contentSpan.style.fontFamily = "var(--font-monospace)";
            contentSpan.style.color = "var(--text-success)";
        } else if (type === "custom") {
            const targetEl = this.isExpanded ? contentSpan : trigger;
            targetEl.style.color = this.foldClass.customTextColor;
            targetEl.style.backgroundColor = this.foldClass.customBgColor;
            targetEl.style.borderColor = this.foldClass.customBorderColor;
            targetEl.style.borderStyle = this.foldClass.customBorderStyle;
            targetEl.style.borderWidth = this.foldClass.customBorderWidth;
            targetEl.style.borderRadius = this.foldClass.customBorderRadius;
            targetEl.style.padding = this.foldClass.customPadding;
            targetEl.style.fontSize = this.foldClass.customFontSize;
        }

        wrapper.appendChild(trigger);
        wrapper.appendChild(contentSpan);

        this.bindEvents(wrapper, trigger, view);
        return wrapper;
    }

    private bindEvents(wrapper: HTMLElement, trigger: HTMLElement, view: EditorView): void {
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
                
                if (type === "ghost") {
                    trigger.style.color = "var(--text-normal)";
                    trigger.style.opacity = "1";
                }

                view.dispatch({
                    effects: setHoveredPositionEffect.of(this.absoluteFrom)
                });

                const contentSpan = wrapper.querySelector(".inline-capsule-content") as HTMLElement;
                const triggerSpan = wrapper.querySelector(".inline-capsule-trigger") as HTMLElement;
                if (contentSpan && triggerSpan && !this.isExpanded) {
                    contentSpan.style.display = "inline";
                    triggerSpan.style.display = "none";
                }
            });

            wrapper.addEventListener("mouseleave", () => {
                const delay = this.globalSettings.hoverCollapseDelay;

                const executeLeave = () => {
                    wrapper.classList.remove("is-hover-revealed");

                    if (type === "ghost") {
                        trigger.style.color = "var(--text-muted)";
                        trigger.style.opacity = "0.8";
                    }

                    view.dispatch({
                        effects: setHoveredPositionEffect.of(null)
                    });

                    const contentSpan = wrapper.querySelector(".inline-capsule-content") as HTMLElement;
                    const triggerSpan = wrapper.querySelector(".inline-capsule-trigger") as HTMLElement;
                    if (contentSpan && triggerSpan && !this.isExpanded) {
                        contentSpan.style.display = "none";
                        triggerSpan.style.display = "inline-block";
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