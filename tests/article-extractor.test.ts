import { describe, expect, it, vi } from "vitest";
import { ArticleExtractor } from "../src/services/article-extractor";
import type { HttpRequester } from "../src/services/http";

describe("ArticleExtractor", () => {
  it("extracts readable HTML and preserves absolute links", async () => {
    const request: HttpRequester = vi.fn(async () => ({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      text: `<!doctype html><html><head><title>Test article</title></head><body>
        <nav>Navigation</nav><article><h1>Test article</h1>
        <p>This is a sufficiently useful article paragraph containing important source material for a study note.</p>
        <p>Read the <a href="/reference">reference page</a> for additional context and examples.</p>
        </article></body></html>`,
      json: null,
    }));

    const article = await new ArticleExtractor(request).extract("https://example.com/posts/one");
    expect(article.title).toContain("Test article");
    expect(article.markdown).toContain("important source material");
    expect(article.markdown).toContain("https://example.com/reference");
    expect(article.markdown).not.toContain("Navigation");
  });

  it("rejects non-HTML responses", async () => {
    const request: HttpRequester = vi.fn(async () => ({
      status: 200,
      headers: { "Content-Type": "application/pdf" },
      text: "PDF",
      json: null,
    }));
    await expect(new ArticleExtractor(request).extract("https://example.com/file.pdf")).rejects.toThrow(
      "not an HTML page",
    );
  });
});
