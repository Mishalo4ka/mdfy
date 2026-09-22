import type { Editor } from "obsidian";
import type { EditorContext } from "./types";

export function captureEditorContext(editor: Editor): EditorContext {
  const noteContent = editor.getValue();
  const selection = editor.getSelection();
  const selectionFrom = editor.getCursor("from");
  const selectionTo = editor.getCursor("to");
  const lastLine = editor.lineCount() - 1;

  return {
    editor,
    noteContent,
    noteWithoutSelection: selection
      ? editor.getRange({ line: 0, ch: 0 }, selectionFrom) +
        editor.getRange(selectionTo, { line: lastLine, ch: editor.getLine(lastLine).length })
      : noteContent,
    selection,
    selectionFrom,
    selectionTo,
    cursor: editor.getCursor(),
  };
}

export function insertAtCursor(context: EditorContext, markdown: string): void {
  context.editor.replaceRange(markdown, context.cursor);
}

export function replaceOriginalSelection(context: EditorContext, markdown: string): void {
  context.editor.replaceRange(markdown, context.selectionFrom, context.selectionTo);
}
