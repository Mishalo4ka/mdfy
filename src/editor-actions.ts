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
    selectionPrefix: editor.getRange({ line: 0, ch: 0 }, selectionTo),
  };
}

export function insertAtCursor(context: EditorContext, markdown: string): void {
  context.editor.replaceRange(markdown, context.editor.getCursor());
}

export function replaceOriginalSelection(context: EditorContext, markdown: string): void {
  if (!context.selection || !context.editor.getValue().startsWith(context.selectionPrefix)) {
    throw new Error("The note changed before or within the original selection. Copy the result or insert it at the current cursor instead.");
  }
  context.editor.replaceRange(markdown, context.selectionFrom, context.selectionTo);
}
