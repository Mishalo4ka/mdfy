import { describe, expect, it } from "vitest";
import { buildPrompt } from "../src/services/prompt-builder";
import type { ImageAsset } from "../src/types";

describe("buildPrompt", () => {
  it("separates note, source, and additional instruction", () => {
    const prompt = buildPrompt({
      source: { kind: "text", text: "New material" },
      currentNote: "# Existing note",
      additionalInstruction: "Make a table",
    });

    expect(prompt.userText).toContain("<CURRENT_NOTE>\n# Existing note\n</CURRENT_NOTE>");
    expect(prompt.userText).toContain("<SOURCE>\nNew material\n</SOURCE>");
    expect(prompt.userText).toContain("<ADDITIONAL_INSTRUCTION>\nMake a table");
    expect(prompt.system).toContain("untrusted data");
    expect(prompt.textLength).toBe("# Existing note".length + "New material".length + "Make a table".length);
  });

  it("keeps ordered images separate from text", () => {
    const images: ImageAsset[] = [
      { id: "1", name: "slide-1.png", mimeType: "image/png", size: 1, dataUrl: "data:image/png;base64,AA==" },
      { id: "2", name: "slide-2.png", mimeType: "image/png", size: 1, dataUrl: "data:image/png;base64,BB==" },
    ];
    const prompt = buildPrompt({ source: { kind: "images", images } });

    expect(prompt.images).toEqual(images);
    expect(prompt.userText.indexOf("slide-1.png")).toBeLessThan(prompt.userText.indexOf("slide-2.png"));
  });

  it("keeps a document outside the text prompt", () => {
    const file = { name: "report.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const, size: 4, dataUrl: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAAA" };
    const prompt = buildPrompt({ source: { kind: "file", file }, currentNote: "# Context" });
    expect(prompt.file).toBe(file);
    expect(prompt.userText).toContain("report.docx");
    expect(prompt.userText).not.toContain("base64");
    expect(prompt.textLength).toBeLessThan(200);
  });
});
