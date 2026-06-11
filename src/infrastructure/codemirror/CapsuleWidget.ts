import { WidgetType, EditorView } from "@codemirror/view";
import { CapsuleSettings } from "../../domain/models/Settings";
import { toggleSingleCapsuleEffect, startEditCapsuleEffect } from "./Extension";

export class CapsuleWidget extends WidgetType {
    constructor(
        private readonly content: string,
        private readonly settings: CapsuleSettings,
        private readonly isExpanded: boolean,
        private readonly absoluteFrom: number
    ) {
        super();
    }

    eq(other: CapsuleWidget): boolean {
        return other.content === this.content && 
               other.isExpanded === this.isExpanded && 
               other.absoluteFrom === this.absoluteFrom &&
               JSON.stringify(other.settings) === JSON.stringify(this.settings);
    }

    toDOM(view: EditorView): HTMLElement {
        const wrapper = document.createElement("span");
        wrapper.className = `inline-capsule-wrapper theme-${this.settings.styleType}`;
        
        if (this.isExpanded) {
            wrapper.classList.add("is-expanded");
        }

        const trigger = document.createElement("span");
        trigger.className = "inline-capsule-trigger";
        trigger.innerText = this.settings.triggerText;

        const contentSpan = document.createElement("span");
        contentSpan.className = "inline-capsule-content";
        contentSpan.innerText = this.content;

        wrapper.appendChild(trigger);
        wrapper.appendChild(contentSpan);

        if (this.settings.styleType === "custom") {
            const targetEl = this.isExpanded ? contentSpan : trigger;
            targetEl.style.color = this.settings.customTextColor;
            targetEl.style.backgroundColor = this.settings.customBgColor;
            targetEl.style.borderColor = this.settings.customBorderColor;
            targetEl.style.borderStyle = this.settings.customBorderStyle;
            targetEl.style.borderWidth = this.settings.customBorderWidth;
            targetEl.style.borderRadius = this.settings.customBorderRadius;
            targetEl.style.padding = this.settings.customPadding;
            targetEl.style.fontSize = this.settings.customFontSize;
        }

        this.bindEvents(wrapper, view);
        return wrapper;
    }

    private bindEvents(wrapper: HTMLElement, view: EditorView): void {
        const mode = this.settings.interactionMode;
        let clickTimer: any = null;

        wrapper.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (clickTimer !== null) return;

            // تسريع المهلة الزمنية لـ 150ms لتكون النقرة طبيعية ولقطة
            clickTimer = setTimeout(() => {
                clickTimer = null;
                if (mode === "click" || mode === "both") {
                    view.dispatch({
                        effects: toggleSingleCapsuleEffect.of(this.absoluteFrom)
                    });
                }
            }, 150);
        });

        wrapper.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (clickTimer !== null) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            view.dispatch({
                effects: startEditCapsuleEffect.of(this.absoluteFrom),
                selection: { anchor: this.absoluteFrom + this.settings.startSymbol.length },
                scrollIntoView: true
            });
        });

        if (mode === "hover" || mode === "both") {
            wrapper.addEventListener("mouseenter", () => {
                wrapper.classList.add("is-hover-revealed");
            });
            wrapper.addEventListener("mouseleave", () => {
                wrapper.classList.remove("is-hover-revealed");
            });
        }
    }

    ignoreEvent(): boolean {
        return true;
    }
}