import { heicTo } from "heic-to/csp";
import { describe, expect, it, vi } from "vitest";
import {
  SourceValidationError,
  fileToDocumentAsset,
  fileToImageAsset,
  fileToTextSource,
  validateTextFile,
  validateDocumentFile,
  validateHttpUrl,
  validateImages,
  validateTextLength,
} from "../src/services/source-validator";
import { MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES, type ImageAsset } from "../src/types";

vi.mock("heic-to/csp", () => ({ heicTo: vi.fn() }));

const image = (overrides: Partial<ImageAsset> = {}): ImageAsset => ({
  id: "id",
  name: "image.png",
  mimeType: "image/png",
  size: 100,
  dataUrl: "data:image/png;base64,AA==",
  ...overrides,
});

describe("source validation", () => {
  it("accepts HTTP URLs and rejects other protocols", () => {
    expect(validateHttpUrl("https://example.com").hostname).toBe("example.com");
    expect(() => validateHttpUrl("file:///tmp/article.html")).toThrow(SourceValidationError);
  });

  it("enforces image count and file size limits", () => {
    expect(() => validateImages([image()])).not.toThrow();
    expect(() => validateImages(Array.from({ length: 11 }, (_, index) => image({ id: String(index) })))).toThrow(
      "up to 10",
    );
    expect(() => validateImages([image({ size: MAX_IMAGE_BYTES + 1 })])).toThrow("larger than 10 MB");
    expect(() =>
      validateImages(
        Array.from({ length: 4 }, (_, index) =>
          image({ id: String(index), size: Math.floor(MAX_TOTAL_IMAGE_BYTES / 4) + 1 }),
        ),
      ),
    ).toThrow("combined image size");
  });

  it("does not silently truncate text", () => {
    expect(() => validateTextLength(101, 100)).toThrow("above the configured 100 character limit");
  });

  it("accepts supported documents and rejects empty, oversized, and unsupported files", async () => {
    const pdf = new File(["document"], "Table.PDF", { type: "application/pdf" });
    expect(validateDocumentFile(pdf)).toBe("application/pdf");
    expect(validateDocumentFile(new File(["x"], "draft.docx"))).toContain("wordprocessingml");
    expect(validateDocumentFile(new File(["x"], "slides.pptx"))).toContain("presentationml");
    expect(() => validateDocumentFile(new File(["x"], "notes.txt"))).toThrow("PDF, DOCX, or PPTX");
    expect(() => validateDocumentFile(new File([], "empty.pdf"))).toThrow("empty");
    const huge = new File(["x"], "huge.pdf");
    Object.defineProperty(huge, "size", { value: MAX_DOCUMENT_BYTES + 1 });
    expect(() => validateDocumentFile(huge)).toThrow("larger than 20 MB");
    const asset = await fileToDocumentAsset(pdf);
    expect(asset.dataUrl).toMatch(/^data:application\/pdf;base64,/);
    expect(asset.name).toBe("Table.PDF");
  });

  it("reads TXT and MD as UTF-8 text and rejects invalid or empty input", async () => {
    const markdown = new File(["# Привет"], "notes.md");
    expect(await fileToTextSource(markdown)).toEqual({ kind: "text", name: "notes.md", text: "# Привет" });
    expect((await fileToTextSource(new File(["hello"], "notes.txt"))).text).toBe("hello");
    expect(() => validateTextFile(new File([], "empty.txt"))).toThrow("empty");
    await expect(fileToTextSource(new File(["   "], "blank.md"))).rejects.toThrow("no text");
    await expect(fileToTextSource(new File([new Uint8Array([0xff])], "bad.txt"))).rejects.toThrow("UTF-8");
    const huge = new File(["x"], "huge.md");
    Object.defineProperty(huge, "size", { value: MAX_DOCUMENT_BYTES + 1 });
    expect(() => validateTextFile(huge)).toThrow("20 MB");
  });

  it("converts HEIC with empty MIME to JPEG and enforces size limits", async () => {
    vi.mocked(heicTo).mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
    const asset = await fileToImageAsset(new File(["heic"], "photo.HEIC"));
    expect(asset.name).toBe("photo.HEIC");
    expect(asset.mimeType).toBe("image/jpeg");
    expect(asset.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(heicTo).toHaveBeenCalledWith(expect.objectContaining({ type: "image/jpeg" }));
    const huge = new File(["x"], "huge.heic");
    Object.defineProperty(huge, "size", { value: MAX_IMAGE_BYTES + 1 });
    await expect(fileToImageAsset(huge)).rejects.toThrow("larger than 10 MB");
    const converted = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)]);
    vi.mocked(heicTo).mockResolvedValue(converted);
    await expect(fileToImageAsset(new File(["x"], "photo.heic"))).rejects.toThrow("after conversion");
    vi.mocked(heicTo).mockResolvedValue(new Blob());
    await expect(fileToImageAsset(new File(["x"], "photo.heic"))).rejects.toThrow("unsupported HEIC variant");
    const cause = new Error("decoder failed");
    vi.mocked(heicTo).mockRejectedValue(cause);
    await expect(fileToImageAsset(new File(["x"], "photo.heic"))).rejects.toMatchObject({ cause });
    vi.mocked(heicTo).mockRejectedValue(new Error("Worker blocked by Content Security Policy"));
    await expect(fileToImageAsset(new File(["x"], "photo.heic"))).rejects.toThrow("environment blocked");
  });
});
