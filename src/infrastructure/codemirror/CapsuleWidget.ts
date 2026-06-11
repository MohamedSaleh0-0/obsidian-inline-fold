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
               other.settings.triggerText === this.settings.triggerText &&
               other.settings.styleType === this.settings.styleType &&
               other.settings.interactionMode === this.settings.interactionMode;
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

        this.bindEvents(wrapper, view);
        return wrapper;
    }

    private bindEvents(wrapper: HTMLElement, view: EditorView): void {
        const mode = this.settings.interactionMode;

        // 1. رصد النقر المزدوج لفتح الماركداون الخام للتعديل الصريح فوراً
        wrapper.addEventListener("dblclick", (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            view.dispatch({
                effects: startEditCapsuleEffect.of(this.absoluteFrom),
                selection: { anchor: this.absoluteFrom + this.settings.startSymbol.length },
                scrollIntoView: true
            });
        });

        // 2. النقر المفرد العادي للتحكم في التوسيع الانسيابي المدمج
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