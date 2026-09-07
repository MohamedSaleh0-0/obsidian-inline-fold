import { Editor, Notice, Plugin } from "obsidian";
import { FoldParser } from "../core/parser";
import { assignFoldKeys, flattenFoldTree } from "../core/foldTree";
import { FoldClass, FoldNode } from "../core/types";
import { PluginDataStore } from "../data/PluginDataStore";

const WORD_CHAR = /[\p{L}\p{N}_-]/u;

export class CommandManager {
  private registeredIds: string[] = [];

  constructor(
    private plugin: Plugin,
    private dataStore: PluginDataStore,
  ) {}

  refresh(): void {
    this.removeAll();
    const settings = this.dataStore.getSettings();

    for (const cls of settings.classes) {
      const toggleId = `toggle-encapsulation-${cls.id}`;
      this.plugin.addCommand({
        id: toggleId,
        name: `Toggle encapsulation: ${cls.name}`,
        editorCallback: (editor: Editor) => this.toggleEncapsulation(editor, cls),
      });
      this.registeredIds.push(toggleId);

      const expandId = `expand-all-${cls.id}`;
      this.plugin.addCommand({
        id: expandId,
        name: `Expand all: ${cls.name}`,
        editorCallback: (editor: Editor) => this.setAllFoldsInFile(editor, true, cls.id),
      });
      this.registeredIds.push(expandId);

      const collapseId = `collapse-all-${cls.id}`;
      this.plugin.addCommand({
        id: collapseId,
        name: `Collapse all: ${cls.name}`,
        editorCallback: (editor: Editor) => this.setAllFoldsInFile(editor, false, cls.id),
      });
      this.registeredIds.push(collapseId);
    }

    const globalId = "toggle-fold-at-cursor";
    this.plugin.addCommand({
      id: globalId,
      name: "Toggle expansion/collapse of folded text",
      editorCallback: (editor: Editor) => this.toggleFoldAtCursor(editor),
    });
    this.registeredIds.push(globalId);

    const expandAllId = "expand-all-folds";
    this.plugin.addCommand({
      id: expandAllId,
      name: "Expand all folds in note",
      editorCallback: (editor: Editor) => this.setAllFoldsInFile(editor, true),
    });
    this.registeredIds.push(expandAllId);

    const collapseAllId = "collapse-all-folds";
    this.plugin.addCommand({
      id: collapseAllId,
      name: "Collapse all folds in note",
      editorCallback: (editor: Editor) => this.setAllFoldsInFile(editor, false),
    });
    this.registeredIds.push(collapseAllId);

    const nextId = "jump-to-next-fold";
    this.plugin.addCommand({
      id: nextId,
      name: "Jump to next fold",
      editorCallback: (editor: Editor) => this.jumpToFold(editor, 1),
    });
    this.registeredIds.push(nextId);

    const prevId = "jump-to-previous-fold";
    this.plugin.addCommand({
      id: prevId,
      name: "Jump to previous fold",
      editorCallback: (editor: Editor) => this.jumpToFold(editor, -1),
    });
    this.registeredIds.push(prevId);

    const focusId = "collapse-all-and-jump-to-first-fold";
    this.plugin.addCommand({
      id: focusId,
      name: "Start focus mode (collapse all, jump to first fold)",
      editorCallback: (editor: Editor) => {
        this.setAllFoldsInFile(editor, false);
        this.jumpToFold(editor, 1, { fromStart: true });
      },
    });
    this.registeredIds.push(focusId);
  }

  private removeAll(): void {
    const commands = (this.plugin.app as unknown as { commands?: { removeCommand?: (id: string) => void } })
      .commands;
    for (const id of this.registeredIds) {
      commands?.removeCommand?.(`${this.plugin.manifest.id}:${id}`);
    }
    this.registeredIds = [];
  }

  /** Wraps/unwraps text in a class's delimiters — an editing operation, distinct from expand/collapse. */
  private toggleEncapsulation(editor: Editor, cls: FoldClass): void {
    const parser = new FoldParser([cls]);
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const lineOffset = editor.posToOffset({ line: cursor.line, ch: 0 });
    const cursorAbs = lineOffset + cursor.ch;

    const hit = flattenFoldTree(parser.parseLine(line, lineOffset)).find(
      (node) => cursorAbs >= node.from && cursorAbs <= node.to,
    );
    if (hit) {
      const fromCh = hit.from - lineOffset;
      const toCh = hit.to - lineOffset;
      editor.replaceRange(hit.content, { line: cursor.line, ch: fromCh }, { line: cursor.line, ch: toCh });
      editor.setCursor({ line: cursor.line, ch: fromCh });
      return;
    }

    if (cls.useRegex) {
      new Notice(
        `"${cls.name}" uses regex delimiters, so there's no fixed text to insert — type something matching the pattern directly instead.`,
      );
      return;
    }

    if (editor.somethingSelected()) {
      const selection = editor.getSelection();
      if (selection.startsWith(cls.startSymbol) && selection.endsWith(cls.endSymbol)) {
        editor.replaceSelection(selection.substring(cls.startSymbol.length, selection.length - cls.endSymbol.length));
      } else {
        editor.replaceSelection(`${cls.startSymbol}${selection}${cls.endSymbol}`);
      }
      return;
    }

    let start = cursor.ch;
    let end = cursor.ch;
    while (start > 0 && WORD_CHAR.test(line[start - 1])) start--;
    while (end < line.length && WORD_CHAR.test(line[end])) end++;

    if (start < end) {
      const word = line.substring(start, end);
      editor.replaceRange(
        `${cls.startSymbol}${word}${cls.endSymbol}`,
        { line: cursor.line, ch: start },
        { line: cursor.line, ch: end },
      );
      editor.setCursor({ line: cursor.line, ch: start + cls.startSymbol.length + word.length + cls.endSymbol.length });
    } else {
      editor.replaceRange(`${cls.startSymbol}${cls.endSymbol}`, cursor);
      editor.setCursor({ line: cursor.line, ch: cursor.ch + cls.startSymbol.length });
    }
  }

  /** Flips persisted expand/collapse state — never touches document text. */
  private toggleFoldAtCursor(editor: Editor): void {
    const settings = this.dataStore.getSettings();
    const filePath = this.plugin.app.workspace.getActiveFile()?.path;
    if (!filePath) return;

    const { allRoots, cursorAbs, cursorLineStart, cursorLineEnd } = this.parseWholeDocument(editor);
    if (allRoots.length === 0) return;

    const keys = assignFoldKeys(allRoots);
    const lineNodes = allRoots.filter((n) => n.from >= cursorLineStart && n.from <= cursorLineEnd);
    if (lineNodes.length === 0) return;

    const flip = (node: FoldNode): void => {
      const key = keys.get(node) as string;
      this.dataStore.setExpanded(filePath, key, !this.dataStore.isExpanded(filePath, key));
    };

    if (settings.hotkeyExpansionTarget === "line") {
      lineNodes.forEach(flip);
      return;
    }

    let closest = lineNodes[0];
    let bestDist = Math.abs(cursorAbs - (closest.from + closest.to) / 2);
    for (const node of lineNodes) {
      const dist = Math.abs(cursorAbs - (node.from + node.to) / 2);
      if (dist < bestDist) {
        bestDist = dist;
        closest = node;
      }
    }
    flip(closest);
  }

  /**
   * Moves the cursor to the next (or previous, direction -1) fold's
   * start in document order, wrapping around at either end so stepping
   * through a note for review is cyclic. With `fromStart`, always jumps
   * to the very first fold rather than "the next one after the cursor"
   * — used by focus mode's initial jump.
   */
  private jumpToFold(editor: Editor, direction: 1 | -1, opts: { fromStart?: boolean } = {}): void {
    const { allRoots, cursorAbs } = this.parseWholeDocument(editor);
    if (allRoots.length === 0) {
      new Notice("No folds in this note.");
      return;
    }

    const sorted = [...allRoots].sort((a, b) => a.from - b.from);
    let target: FoldNode;
    if (opts.fromStart) {
      target = sorted[0];
    } else if (direction === 1) {
      target = sorted.find((n) => n.from > cursorAbs) ?? sorted[0];
    } else {
      target = [...sorted].reverse().find((n) => n.from < cursorAbs) ?? sorted[sorted.length - 1];
    }

    const pos = editor.offsetToPos(target.from);
    editor.setCursor(pos);
    editor.scrollIntoView({ from: pos, to: editor.offsetToPos(target.to) }, true);
  }

  /** Sets every fold in the note (or every fold of one class, if classId
   * is given) to expanded/collapsed. Includes nested folds, not just
   * top-level ones — flattenFoldTree covers the whole tree.
   *
   * Positions here are per-line (offset 0 for each line) rather than
   * absolute — fine, since assignFoldKeys never looks at position, only
   * traversal order, and processing lines top-to-bottom in order
   * produces identical keys to the absolute-offset version used
   * elsewhere.
   */
  private setAllFoldsInFile(editor: Editor, expanded: boolean, classId?: string): void {
    const filePath = this.plugin.app.workspace.getActiveFile()?.path;
    if (!filePath) return;

    const settings = this.dataStore.getSettings();
    const parser = new FoldParser(settings.classes);

    const allRoots: FoldNode[] = [];
    for (let i = 0; i < editor.lineCount(); i++) {
      allRoots.push(...parser.parseLine(editor.getLine(i), 0));
    }

    const keys = assignFoldKeys(allRoots);
    const targetKeys: string[] = [];
    for (const node of flattenFoldTree(allRoots)) {
      if (classId && node.classId !== classId) continue;
      targetKeys.push(keys.get(node) as string);
    }
    this.dataStore.setManyExpanded(filePath, targetKeys, expanded);
  }

  /**
   * Parses the whole document with real absolute offsets (via Editor's
   * own posToOffset, so no hand-rolled line-length accumulation) —
   * needed wherever a command has to reason about cursor position
   * against fold positions, or produce keys consistent with what Live
   * Preview/Reading view compute from the same document.
   */
  private parseWholeDocument(editor: Editor): {
    allRoots: FoldNode[];
    cursorAbs: number;
    cursorLineStart: number;
    cursorLineEnd: number;
  } {
    const settings = this.dataStore.getSettings();
    const parser = new FoldParser(settings.classes);
    const cursor = editor.getCursor();
    const cursorAbs = editor.posToOffset(cursor);
    const cursorLineStart = editor.posToOffset({ line: cursor.line, ch: 0 });
    const cursorLineEnd = cursorLineStart + editor.getLine(cursor.line).length;

    const allRoots: FoldNode[] = [];
    for (let i = 0; i < editor.lineCount(); i++) {
      allRoots.push(...parser.parseLine(editor.getLine(i), editor.posToOffset({ line: i, ch: 0 })));
    }

    return { allRoots, cursorAbs, cursorLineStart, cursorLineEnd };
  }
}
