import { WidgetType } from "@codemirror/view";
import { FoldNode } from "../core/types";
import { FoldRenderContext, renderFoldNode } from "../render/domBuilder";

/**
 * A thin CM6 adapter: all of the actual DOM construction, styling, and
 * event wiring is shared with Reading view via renderFoldNode. This
 * widget's only job is satisfying WidgetType's contract (eq/toDOM/
 * ignoreEvent) and reusing DOM across redraws where possible.
 */
export class FoldWidget extends WidgetType {
  constructor(
    private readonly node: FoldNode,
    private readonly ctx: FoldRenderContext,
    private readonly expanded: boolean,
  ) {
    super();
  }

  eq(other: FoldWidget): boolean {
    return (
      other.node.from === this.node.from &&
      other.node.to === this.node.to &&
      other.node.content === this.node.content &&
      other.node.classId === this.node.classId &&
      other.node.alias === this.node.alias &&
      other.expanded === this.expanded &&
      other.ctx.settings === this.ctx.settings
    );
  }

  toDOM(): HTMLElement {
    return renderFoldNode(this.node, this.ctx);
  }

  ignoreEvent(): boolean {
    // The widget's own click/hover handlers manage everything; don't let
    // CM6 additionally try to interpret clicks as cursor placement.
    return true;
  }
}
