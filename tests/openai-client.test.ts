import { heicTo } from "heic-to/csp";
import { describe, expect, it, vi } from "vitest";
import { LlmRequestError, OpenAiCompatibleClient, chatCompletionsUrl, responsesUrl } from "../src/services/openai-client";
import { buildPrompt } from "../src/services/prompt-builder";
import { fileToImageAsset, fileToTextSource, validateTextLength } from "../src/services/source-validator";
import type { HttpRequester } from "../src/services/http";
import type { MdfySettings, PromptPayload } from "../src/types";

vi.mock("heic-to/csp", () => ({ heicTo: vi.fn() }));

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

const filePrompt: PromptPayload = {
  ...prompt,
  file: { name: "table.pdf", mimeType: "application/pdf", size: 4, dataUrl: "data:application/pdf;base64,AAAA" },
};

describe.each([
  { endpoint: "chat/completions", input: prompt, json: { choices: [{ message: { content: "# Done" } }] } },
  { endpoint: "responses", input: filePrompt, json: { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "# Done" }] }] } },
])("shared request handling for $endpoint", ({ endpoint, input, json }) => {
  it("posts JSON with optional authentication and clears the timeout", async () => {
    vi.useFakeTimers();
    try {
      const request: HttpRequester = vi.fn(async () => ({ status: 200, headers: {}, text: "", json }));
      const client = new OpenAiCompatibleClient(request);
      for (const apiKey of [null, "secret"]) {
        await expect(client.complete(settings, apiKey, input)).resolves.toBe("# Done");
        const call = vi.mocked(request).mock.lastCall?.[0];
        expect(call).toMatchObject({
          url: `https://provider.example/v1/${endpoint}`,
          method: "POST",
          throw: false,
          headers: apiKey
            ? { "Content-Type": "application/json", Authorization: "Bearer secret" }
            : { "Content-Type": "application/json" },
        });
        if (!apiKey) expect(call?.headers).not.toHaveProperty("Authorization");
        expect(JSON.parse(call?.body ?? "{}")).toMatchObject({ model: settings.model });
        expect(vi.getTimerCount()).toBe(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("wraps network failures and preserves existing request errors", async () => {
    const existing = new LlmRequestError("Already classified", 503);
    for (const failure of [new Error("Offline"), "network failure", existing]) {
      const request: HttpRequester = vi.fn().mockRejectedValue(failure);
      const result = new OpenAiCompatibleClient(request).complete(settings, null, input);
      if (failure === existing) await expect(result).rejects.toBe(existing);
      else {
        await expect(result).rejects.toBeInstanceOf(LlmRequestError);
        await expect(result).rejects.toMatchObject({
          message: failure instanceof Error ? "Offline" : "The network request failed.",
        });
      }
    }
  });

  it("times out a pending request and clears its timer", async () => {
    vi.useFakeTimers();
    try {
      const request: HttpRequester = vi.fn(() => new Promise<never>(() => {}));
      const result = new OpenAiCompatibleClient(request).complete(settings, null, input);
      const rejection = expect(result).rejects.toThrow("The request timed out.");
      await vi.advanceTimersByTimeAsync(settings.timeoutSeconds * 1_000);
      await rejection;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

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

  it("sends converted HEIC as JPEG through Chat Completions", async () => {
    vi.mocked(heicTo).mockResolvedValue(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }));
    const asset = await fileToImageAsset(new File(["heic"], "photo.HEIC"));
    const request: HttpRequester = vi.fn(async () => ({
      status: 200, headers: {}, text: "", json: { choices: [{ message: { content: "# Done" } }] },
    }));
    await new OpenAiCompatibleClient(request).complete(settings, null, { ...prompt, images: [asset] });
    const call = vi.mocked(request).mock.calls[0]?.[0];
    expect(call?.url).toBe("https://provider.example/v1/chat/completions");
    expect(call?.body).toContain(`"url":"${asset.dataUrl}"`);
    expect(asset.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(call?.body).not.toContain("image/heic");
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

  it.each([
    { input: prompt, status: 404, message: "The Chat Completions endpoint or model was not found. Provider detail" },
    { input: filePrompt, status: 404, message: "The provider does not offer the Responses endpoint, or the model was not found. Provider detail" },
    { input: prompt, status: 413, message: "The request is too large. Remove images or shorten the input. Provider detail" },
    { input: filePrompt, status: 413, message: "The document request is too large. Choose a smaller file." },
  ])("preserves endpoint-specific HTTP $status errors: $message", async ({ input, status, message }) => {
    const request: HttpRequester = vi.fn(async () => ({
      status, headers: {}, text: "", json: { error: { message: "Provider detail" } },
    }));
    await expect(new OpenAiCompatibleClient(request).complete(settings, null, input))
      .rejects.toMatchObject({ status, message });
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
