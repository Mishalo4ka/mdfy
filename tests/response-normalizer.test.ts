import { describe, expect, it } from "vitest";
import { normalizeMarkdownResponse } from "../src/services/response-normalizer";

describe("normalizeMarkdownResponse", () => {
  it("removes a single outer Markdown fence", () => {
    expect(normalizeMarkdownResponse("```markdown\n# Title\n\nText\n```")).toBe("# Title\n\nText");
  });

  it("preserves internal code fences", () => {
    const markdown = "# Example\n\n```ts\nconst value = 1;\n```";
    expect(normalizeMarkdownResponse(markdown)).toBe(markdown);
  });
});
