import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleClient, chatCompletionsUrl, responsesUrl } from "../src/services/openai-client";
import { buildPrompt } from "../src/services/prompt-builder";
import { fileToTextSource, validateTextLength } from "../src/services/source-validator";
import type { HttpRequester } from "../src/services/http";
import type { MdfySettings, PromptPayload } from "../src/types";

const settings: MdfySettings = {
  baseUrl: "https://provider.example/v1/",
  model: "vision-model",
  secretName: "provider-key",
  maxInputCharacters: 60_000,
  maxOutputTokens: 1_000,
  timeoutSeconds: 5,
};

const prompt: PromptPayload = {
  system: "System",
  userText: "User",
  images: [],
  textLength: 4,
};

describe("OpenAiCompatibleClient", () => {
  it("builds the standard endpoint without duplicate slashes", () => {
    expect(chatCompletionsUrl(settings.baseUrl)).toBe("https://provider.example/v1/chat/completions");
    expect(chatCompletionsUrl("https://provider.example/v1/chat/completions")).toBe(
      "https://provider.example/v1/chat/completions",
    );
    expect(responsesUrl("https://provider.example/v1/chat/completions")).toBe("https://provider.example/v1/responses");
  });

  it("sends text and images using Chat Completions content parts", async () => {
    const request: HttpRequester = vi.fn(async () => ({
      status: 200,
      headers: {},
      text: "",
      json: { choices: [{ message: { content: "```md\n# Result\n```" } }] },
    }));
    const client = new OpenAiCompatibleClient(request);
    const result = await client.complete(settings, "secret", {
      ...prompt,
      images: [
        { id: "1", name: "slide.png", mimeType: "image/png", size: 1, dataUrl: "data:image/png;base64,AA==" },
      ],
    });

    expect(result).toBe("# Result");
    const call = vi.mocked(request).mock.calls[0]?.[0];
    expect(call?.headers?.Authorization).toBe("Bearer secret");
    expect(call?.body).toContain('"type":"image_url"');
    expect(call?.body).toContain("data:image/png;base64,AA==");
  });

  it("sends TXT/MD files through Chat Completions and applies the text limit", async () => {
    const request: HttpRequester = vi.fn(async () => ({
      status: 200, headers: {}, text: "", json: { choices: [{ message: { content: "# Done" } }] },
    }));
    for (const name of ["notes.txt", "notes.md"]) {
      const source = await fileToTextSource(new File(["# Source"], name));
      const textPrompt = buildPrompt({ source });
      expect(() => validateTextLength(textPrompt.textLength, 5)).toThrow("above the configured");
      await new OpenAiCompatibleClient(request).complete(settings, null, textPrompt);
    }
    for (const [call] of vi.mocked(request).mock.calls) {
      expect(call.url).toBe("https://provider.example/v1/chat/completions");
      expect(call.body).toContain("# Source");
      expect(call.body).not.toContain("input_file");
    }
  });

  it("maps provider errors to actionable messages", async () => {
    const request: HttpRequester = vi.fn(async () => ({
      status: 429,
      headers: {},
      text: "",
      json: { error: { message: "Try later" } },
    }));
    await expect(new OpenAiCompatibleClient(request).complete(settings, null, prompt)).rejects.toThrow(
      "rate limit",
    );
  });

  it("sends a complete document to Responses and joins all output text", async () => {
    const request: HttpRequester = vi.fn(async () => ({
      status: 200,
      headers: {},
      text: "",
      json: {
        status: "completed",
        output: [
          { type: "reasoning" },
          { type: "message", content: [{ type: "output_text", text: "# Table" }] },
          { type: "message", content: [{ type: "output_text", text: "| A | B |" }] },
        ],
      },
    }));
    const result = await new OpenAiCompatibleClient(request).complete(settings, "secret", {
      ...prompt,
      file: { name: "table.pdf", mimeType: "application/pdf", size: 4, dataUrl: "data:application/pdf;base64,AAAA" },
    });
    expect(result).toBe("# Table\n| A | B |");
    const call = vi.mocked(request).mock.calls[0]?.[0];
    expect(call?.url).toBe("https://provider.example/v1/responses");
    const body = JSON.parse(call?.body ?? "{}") as Record<string, unknown>;
    expect(JSON.stringify(body)).toContain('"type":"input_file"');
    expect(JSON.stringify(body)).toContain("data:application/pdf;base64,AAAA");
    expect(body.store).toBe(false);
  });

  it("reports unsupported endpoints and incomplete document responses", async () => {
    const filePrompt: PromptPayload = {
      ...prompt,
      file: { name: "table.pdf", mimeType: "application/pdf", size: 4, dataUrl: "data:application/pdf;base64,AAAA" },
    };
    const unavailable: HttpRequester = vi.fn(async () => ({ status: 404, headers: {}, text: "Not found", json: {} }));
    await expect(new OpenAiCompatibleClient(unavailable).complete(settings, null, filePrompt)).rejects.toThrow("Responses endpoint");
    const incomplete: HttpRequester = vi.fn(async () => ({
      status: 200,
      headers: {},
      text: "",
      json: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] },
    }));
    await expect(new OpenAiCompatibleClient(incomplete).complete(settings, null, filePrompt)).rejects.toThrow("max_output_tokens");
    const empty: HttpRequester = vi.fn(async () => ({ status: 200, headers: {}, text: "", json: { status: "completed", output: [] } }));
    await expect(new OpenAiCompatibleClient(empty).complete(settings, null, filePrompt)).rejects.toThrow("no Markdown content");
  });
});
