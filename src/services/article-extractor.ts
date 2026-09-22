import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import type { ArticleSource } from "../types";
import type { HttpRequester } from "./http";
import { SourceValidationError, validateHttpUrl } from "./source-validator";

export class ArticleExtractor {
  constructor(private readonly request: HttpRequester) {}

  async extract(value: string): Promise<ArticleSource> {
    const url = validateHttpUrl(value);
    const response = await this.request({
      url: url.toString(),
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
      throw: false,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new SourceValidationError(`The page returned HTTP ${response.status}.`);
    }

    const contentType = getHeader(response.headers, "content-type");
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new SourceValidationError(`The URL returned ${contentType}, not an HTML page.`);
    }

    const document = new DOMParser().parseFromString(response.text, "text/html");
    const base = document.createElement("base");
    base.href = url.toString();
    document.head.prepend(base);
    const article = new Readability(document.cloneNode(true) as Document).parse();
    if (!article?.content || !(article.textContent ?? "").trim()) {
      throw new SourceValidationError(
        "Could not extract an article from this page. Paste its text into the Text tab instead.",
      );
    }

    const container = document.createElement("div");
    container.innerHTML = article.content;
    absolutizeLinks(container, url);

    const turndown = new TurndownService({
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      headingStyle: "atx",
    });
    turndown.use(gfm);
    const markdown = turndown.turndown(container.innerHTML).trim();
    if (!markdown) {
      throw new SourceValidationError(
        "The article did not contain usable text. Paste its text into the Text tab instead.",
      );
    }

    return {
      kind: "article",
      url: url.toString(),
      title: article.title?.trim() || url.hostname,
      byline: article.byline?.trim() || undefined,
      markdown,
    };
  }
}

function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

function absolutizeLinks(container: HTMLElement, baseUrl: URL): void {
  for (const element of container.querySelectorAll<HTMLElement>("a[href], img[src]")) {
    const attribute = element.tagName === "A" ? "href" : "src";
    const value = element.getAttribute(attribute);
    if (!value) continue;
    try {
      element.setAttribute(attribute, new URL(value, baseUrl).toString());
    } catch {
      element.removeAttribute(attribute);
    }
  }
}
