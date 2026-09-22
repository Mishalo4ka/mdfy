import type { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";
import { captureEditorContext } from "../src/editor-actions";
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

function offset(text: string, position: EditorPosition): number {
  const lines = text.split("\n");
  return lines.slice(0, position.line).join("\n").length + (position.line > 0 ? 1 : 0) + position.ch;
}
