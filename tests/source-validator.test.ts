import { describe, expect, it } from "vitest";
import {
  SourceValidationError,
  validateHttpUrl,
  validateImages,
  validateTextLength,
} from "../src/services/source-validator";
import { MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES, type ImageAsset } from "../src/types";

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
});
