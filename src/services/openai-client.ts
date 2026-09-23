import type { MdfySettings, PromptPayload } from "../types";
import type { HttpRequester } from "./http";
import { normalizeMarkdownResponse } from "./response-normalizer";

interface TextPart {
  type: "text";
  text: string;
}

interface ImagePart {
  type: "image_url";
  image_url: {
    url: string;
  };
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface ModelResponse {
  status?: string;
  error?: { message?: string };
  incomplete_details?: { reason?: string };
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

export class LlmRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export class OpenAiCompatibleClient {
  constructor(private readonly request: HttpRequester) {}

  async complete(settings: MdfySettings, apiKey: string | null, prompt: PromptPayload): Promise<string> {
    if (prompt.file) return this.completeFile(settings, apiKey, prompt);
    const content: Array<TextPart | ImagePart> = [{ type: "text", text: prompt.userText }];
    for (const image of prompt.images) {
      content.push({ type: "image_url", image_url: { url: image.dataUrl } });
    }

    const body = {
      model: settings.model.trim(),
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content },
      ],
      max_tokens: settings.maxOutputTokens,
      stream: false,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    let response;
    try {
      response = await withTimeout(
        this.request({
          url: chatCompletionsUrl(settings.baseUrl),
          method: "POST",
          headers,
          body: JSON.stringify(body),
          throw: false,
        }),
        settings.timeoutSeconds * 1_000,
      );
    } catch (error) {
      if (error instanceof LlmRequestError) throw error;
      throw new LlmRequestError(error instanceof Error ? error.message : "The network request failed.");
    }

    const payload = asChatResponse(response.json);
    if (response.status < 200 || response.status >= 300) {
      const detail = payload.error?.message || response.text.slice(0, 300).trim();
      throw new LlmRequestError(statusMessage(response.status, detail), response.status);
    }

    const contentValue = payload.choices?.[0]?.message?.content;
    const markdown = readContent(contentValue);
    if (!markdown) {
      throw new LlmRequestError("The endpoint returned no Markdown content.");
    }
    return normalizeMarkdownResponse(markdown);
  }

  private async completeFile(settings: MdfySettings, apiKey: string | null, prompt: PromptPayload): Promise<string> {
    const file = prompt.file;
    if (!file) throw new LlmRequestError("Choose a document first.");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    let response;
    try {
      response = await withTimeout(
        this.request({
          url: responsesUrl(settings.baseUrl),
          method: "POST",
          headers,
          body: JSON.stringify({
            model: settings.model.trim(),
            instructions: prompt.system,
            input: [{
              role: "user",
              content: [
                { type: "input_text", text: prompt.userText },
                { type: "input_file", filename: file.name, file_data: file.dataUrl },
              ],
            }],
            max_output_tokens: settings.maxOutputTokens,
            store: false,
          }),
          throw: false,
        }),
        settings.timeoutSeconds * 1_000,
      );
    } catch (error) {
      if (error instanceof LlmRequestError) throw error;
      throw new LlmRequestError(error instanceof Error ? error.message : "The network request failed.");
    }

    if (response.status < 200 || response.status >= 300) {
      let providerMessage = "";
      try {
        providerMessage = asModelResponse(response.json).error?.message ?? "";
      } catch {
        // Some providers return non-JSON error pages for unsupported endpoints.
      }
      const detail = providerMessage || response.text.slice(0, 300).trim();
      if (response.status === 404) {
        throw new LlmRequestError(`The provider does not offer the Responses endpoint, or the model was not found.${detail ? ` ${detail}` : ""}`, 404);
      }
      if (response.status === 413) throw new LlmRequestError("The document request is too large. Choose a smaller file.", 413);
      throw new LlmRequestError(statusMessage(response.status, detail), response.status);
    }
    let payload: ModelResponse;
    try {
      payload = asModelResponse(response.json);
    } catch {
      throw new LlmRequestError("The provider returned an invalid Responses API result.");
    }
    if (payload.status === "incomplete") {
      throw new LlmRequestError(`The model stopped before finishing the document${payload.incomplete_details?.reason ? ` (${payload.incomplete_details.reason})` : ""}. Try a shorter file or increase the output token limit.`);
    }
    if (payload.status && payload.status !== "completed") {
      throw new LlmRequestError(payload.error?.message || `The provider returned response status ${payload.status}.`);
    }
    const markdown = payload.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n");
    if (!markdown?.trim()) throw new LlmRequestError("The endpoint returned no Markdown content.");
    return normalizeMarkdownResponse(markdown);
  }

  async testConnection(settings: MdfySettings, apiKey: string | null): Promise<void> {
    await this.complete(settings, apiKey, {
      system: "Reply with OK only.",
      userText: "Connection test",
      images: [],
      textLength: 15,
    });
  }
}

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new LlmRequestError("Configure an API base URL first.");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

export function responsesUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) throw new LlmRequestError("Configure an API base URL first.");
  const root = trimmed.replace(/\/(?:chat\/completions|responses)$/, "");
  return `${root}/responses`;
}

function asChatResponse(value: unknown): ChatCompletionResponse {
  if (typeof value !== "object" || value === null) return {};
  return value as ChatCompletionResponse;
}

function asModelResponse(value: unknown): ModelResponse {
  if (typeof value !== "object" || value === null) return {};
  return value as ModelResponse;
}

function readContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

function statusMessage(status: number, detail: string): string {
  const suffix = detail ? ` ${detail}` : "";
  switch (status) {
    case 401:
    case 403:
      return `Authentication failed.${suffix}`;
    case 404:
      return `The Chat Completions endpoint or model was not found.${suffix}`;
    case 413:
      return `The request is too large. Remove images or shorten the input.${suffix}`;
    case 429:
      return `The provider rate limit was reached.${suffix}`;
    default:
      return `The provider returned HTTP ${status}.${suffix}`;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LlmRequestError("The request timed out.")), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
