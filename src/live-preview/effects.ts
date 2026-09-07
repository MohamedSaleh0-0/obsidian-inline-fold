import { StateEffect } from "@codemirror/state";

/**
 * Forces the fold StateField to rebuild its decorations from the
 * PluginDataStore. Dispatched whenever expansion state changes for the
 * file this editor is showing (including changes made from a different
 * pane, or from Reading view) or when settings are edited.
 *
 * There is deliberately no "toggle" effect here — toggling a fold no
 * longer flows through CM6's dispatch cycle at all. It's a direct write
 * to PluginDataStore (see render/domBuilder.ts's onToggle), which is
 * the single source of truth; this effect just tells already-open
 * editors to re-read it.
 */
export const refreshDecorationsEffect = StateEffect.define<null>();
