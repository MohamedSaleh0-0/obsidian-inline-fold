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
        wrapper.style.cursor = "pointer"; // Hard override against CodeMirror canvas text cursors

        const trigger = document.createElement("span");
        trigger.className = "inline-capsule-trigger";
        trigger.innerText = this.foldClass.triggerText;
        trigger.style.cursor = "pointer"; // Force pointer finger style

        const contentSpan = document.createElement("span");
        contentSpan.className = "inline-capsule-content";
        contentSpan.innerText = this.content;
        contentSpan.style.cursor = "pointer"; // Force pointer finger style

        if (this.isExpanded) {
            wrapper.classList.add("is-expanded");
            contentSpan.style.display = "inline";
            trigger.style.display = "none";
        } else {
            contentSpan.style.display = "none";
            trigger.style.display = "inline-block";
        }

        wrapper.appendChild(trigger);
        wrapper.appendChild(contentSpan);

        if (this.foldClass.styleType === "custom") {
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

        this.bindEvents(wrapper, view);
        return wrapper;
    }

    private bindEvents(wrapper: HTMLElement, view: EditorView): void {
        const mode = this.globalSettings.interactionMode;

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