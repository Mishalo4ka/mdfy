import type { Editor, EditorPosition } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { captureEditorContext, insertAtCursor, replaceOriginalSelection } from "../src/editor-actions";
import { buildPrompt } from "../src/services/prompt-builder";

describe("selected text as a source", () => {
  it("keeps the selection as input while excluding it from note context", () => {
    const note = "# Lecture\nOld passage\n## Next topic";
    const from: EditorPosition = { line: 1, ch: 0 };
    const to: EditorPosition = { line: 1, ch: 11 };
    const editor = {
      getValue: () => note,
      getSelection: () => "Old passage",
      getCursor: (side?: "from" | "to") => (side === "from" ? from : to),
      getRange: (start: EditorPosition, end: EditorPosition) =>
        note.slice(offset(note, start), offset(note, end)),
      lineCount: () => 3,
      getLine: (line: number) => note.split("\n")[line],
    } as unknown as Editor;

    const context = captureEditorContext(editor);
    const prompt = buildPrompt({
      source: { kind: "text", text: context.selection },
      currentNote: context.noteWithoutSelection,
    });

    expect(context.selection).toBe("Old passage");
    expect(context.noteWithoutSelection).toBe("# Lecture\n\n## Next topic");
    expect(prompt.userText).toContain("<SOURCE>\nOld passage\n</SOURCE>");
    expect(prompt.userText).toContain("<CURRENT_NOTE>\n# Lecture\n\n## Next topic\n</CURRENT_NOTE>");
  });
});

describe("editor actions", () => {
  const original = "# Lecture\nOld passage\n## Next topic";
  const from: EditorPosition = { line: 1, ch: 0 };
  const to: EditorPosition = { line: 1, ch: 11 };

  function setup() {
    const editor = {
      getValue: vi.fn(() => original),
      getSelection: () => "Old passage",
      getCursor: vi.fn((side?: "from" | "to") => side === "from" ? from : to),
      getRange: (start: EditorPosition, end: EditorPosition) =>
        original.slice(offset(original, start), offset(original, end)),
      lineCount: () => 3,
      getLine: (line: number) => original.split("\n")[line],
      replaceRange: vi.fn(),
    };
    return { editor, context: captureEditorContext(editor as unknown as Editor) };
  }

  it("inserts at the current cursor after the note and cursor change", () => {
    const { editor, context } = setup();
    const cursor = { line: 0, ch: 3 };
    editor.getValue.mockReturnValue("New note");
    editor.getCursor.mockReturnValue(cursor);

    insertAtCursor(context, "Result");

    expect(editor.replaceRange).toHaveBeenCalledWith("Result", cursor);
  });

  it.each([original, "# Lecture\nOld passage\nUpdated ending"])(
    "replaces the original selection when its prefix is unchanged: %s",
    (note) => {
      const { editor, context } = setup();
      editor.getValue.mockReturnValue(note);
      editor.getCursor.mockReturnValue({ line: 0, ch: 0 });

      replaceOriginalSelection(context, "Result");

      expect(editor.replaceRange).toHaveBeenCalledWith("Result", from, to);
    },
  );

  it.each(["# Changed\nOld passage\n## Next topic", `New line\n${original}`, "# Lecture\nNew passage\n## Next topic", ""])(
    "rejects replacement after a change before or within the selection: %s",
    (note) => {
      const { editor, context } = setup();
      editor.getValue.mockReturnValue(note);

      expect(() => replaceOriginalSelection(context, "Result")).toThrow("The note changed");
      expect(editor.replaceRange).not.toHaveBeenCalled();
    },
  );
});

function offset(text: string, position: EditorPosition): number {
  const lines = text.split("\n");
  return lines.slice(0, position.line).join("\n").length + (position.line > 0 ? 1 : 0) + position.ch;
}
