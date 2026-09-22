import { describe, expect, it, vi } from "vitest";
import { OpenAiCompatibleClient, chatCompletionsUrl } from "../src/services/openai-client";
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
});
