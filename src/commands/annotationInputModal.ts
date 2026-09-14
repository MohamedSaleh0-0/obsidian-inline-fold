import { App, Modal, Notice, Setting } from "obsidian";

export interface AnnotationInput {
  term: string;
  definition: string;
}

/**
 * Prompts for the two pieces an annotation needs — the always-visible
 * term and its popover definition — instead of the plain wrap-in-
 * delimiters the "Toggle encapsulation" command uses for hidden
 * (fold) classes. A fold's content can just be typed inline after
 * wrapping, since it's one continuous piece of text; an annotation
 * needs both a term *and* a separate definition, which doesn't fit
 * that same "wrap and keep typing" flow.
 */
export class AnnotationInputModal extends Modal {
  private term: string;
  private definition = "";

  constructor(
    app: App,
    initialTerm: string,
    private onSubmit: (result: AnnotationInput) => void,
  ) {
    super(app);
    this.term = initialTerm;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.setTitle("Insert annotation");

    new Setting(contentEl)
      .setName("Text")
      .setDesc("The word or phrase that stays visible in your note.")
      .addText((text) => {
        text
          .setValue(this.term)
          .setPlaceholder("e.g. mitochondria")
          .onChange((value) => (this.term = value));
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(contentEl)
      .setName("Definition")
      .setDesc("Shown in a popover on hover/click. Markdown is fine if this class's popover content is set to Rich.");

    const textarea = contentEl.createEl("textarea", { cls: "inline-fold-annotation-modal-textarea" });
    textarea.rows = 5;
    textarea.placeholder = "e.g. the powerhouse of the cell";
    textarea.addEventListener("input", () => {
      this.definition = textarea.value;
    });
    textarea.addEventListener("keydown", (evt) => {
      if ((evt.metaKey || evt.ctrlKey) && evt.key === "Enter") {
        evt.preventDefault();
        this.submit();
      }
    });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Insert")
        .setCta()
        .onClick(() => this.submit()),
    );
  }

  private submit(): void {
    if (!this.term.trim()) {
      new Notice("Type the text that should stay visible first.");
      return;
    }
    this.onSubmit({ term: this.term, definition: this.definition });
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
