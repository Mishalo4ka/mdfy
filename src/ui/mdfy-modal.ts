import { Modal, Notice, Setting, TextComponent, setIcon, type App } from "obsidian";
import { insertAtCursor, replaceOriginalSelection } from "../editor-actions";
import { buildPrompt } from "../services/prompt-builder";
import {
  fileToDocumentAsset,
  fileToImageAsset,
  fileToTextSource,
  isTextFile,
  SourceValidationError,
  validateDocumentFile,
  validateTextFile,
  validateImages,
  validateTextLength,
} from "../services/source-validator";
import type { ArticleExtractor } from "../services/article-extractor";
import type { OpenAiCompatibleClient } from "../services/openai-client";
import type {
  EditorContext,
  ImageAsset,
  MdfySettings,
  PromptSource,
} from "../types";

type SourceTab = "text" | "images" | "url" | "file";

interface MdfyModalOptions {
  context: EditorContext;
  settings: MdfySettings;
  articleExtractor: ArticleExtractor;
  client: OpenAiCompatibleClient;
  getApiKey: () => string | null;
}

export class MdfyModal extends Modal {
  private readonly context: EditorContext;
  private readonly settings: MdfySettings;
  private readonly articleExtractor: ArticleExtractor;
  private readonly client: OpenAiCompatibleClient;
  private readonly getApiKey: () => string | null;

  private activeTab: SourceTab = "text";
  private text = "";
  private url = "";
  private images: ImageAsset[] = [];
  private documentFile: File | null = null;
  private additionalInstruction = "";
  private useNoteContext = true;
  private result = "";
  private timingSummary = "";
  private busy = false;

  constructor(app: App, options: MdfyModalOptions) {
    super(app);
    this.context = options.context;
    this.text = options.context.selection;
    this.settings = options.settings;
    this.articleExtractor = options.articleExtractor;
    this.client = options.client;
    this.getApiKey = options.getApiKey;
  }

  onOpen(): void {
    this.modalEl.addClass("mdfy-modal");
    this.renderInput();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderInput(): void {
    const { contentEl } = this;
    contentEl.empty();
    const header = contentEl.createDiv({ cls: "mdfy-header" });
    header.createEl("h2", { text: "Format with mdfy" });
    const sourcePicker = header.createDiv({
      cls: "mdfy-source-picker",
      attr: { role: "group", "aria-label": "Source type" },
    });
    this.addSourceButton(sourcePicker, "text", "Text", "file-text");
    this.addSourceButton(sourcePicker, "url", "URL", "link");
    this.addSourceButton(sourcePicker, "images", "Images", "image");
    this.addSourceButton(sourcePicker, "file", "Files", "paperclip");

    const sourceContainer = contentEl.createDiv({ cls: "mdfy-source" });
    if (this.activeTab === "text") this.renderTextSource(sourceContainer);
    if (this.activeTab === "images") this.renderImageSource(sourceContainer);
    if (this.activeTab === "url") this.renderUrlSource(sourceContainer);
    if (this.activeTab === "file") this.renderFileSource(sourceContainer);

    const instructionBlock = contentEl.createDiv({ cls: "mdfy-instruction-block" });
    instructionBlock.createEl("label", {
      cls: "setting-item-name",
      text: "Additional instruction",
      attr: { for: "mdfy-additional-instruction" },
    });
    const instruction = instructionBlock.createEl("textarea", {
      cls: "mdfy-instruction-input",
      attr: {
        id: "mdfy-additional-instruction",
        placeholder: "Optional: summarize, make a table, highlight definitions…",
      },
    });
    instruction.rows = 1;
    instruction.value = this.additionalInstruction;
    instruction.addEventListener("input", () => {
      this.additionalInstruction = instruction.value;
    });

    new Setting(contentEl)
      .setClass("mdfy-context-setting")
      .setName("Use current note as context")
      .setDesc("The full note will be sent to your configured LLM provider to match its style and avoid repetition. Longer notes can take more time.")
      .addToggle((toggle) =>
        toggle.setValue(this.useNoteContext).onChange((value) => {
          this.useNoteContext = value;
        }),
      );

    const footer = contentEl.createDiv({ cls: "mdfy-footer" });
    const status = footer.createDiv({ cls: "mdfy-status", attr: { "aria-live": "polite" } });
    const generate = footer.createEl("button", { cls: "mod-cta", text: "Generate Markdown" });
    generate.disabled = this.busy;
    generate.addEventListener("click", () => void this.generate(generate, status));
  }

  private addSourceButton(container: HTMLElement, source: SourceTab, label: string, icon: string): void {
    const button = container.createEl("button", {
      cls: this.activeTab === source
        ? "clickable-icon mdfy-source-button is-active"
        : "clickable-icon mdfy-source-button",
      attr: {
        type: "button",
        title: label,
        "aria-label": label,
        "aria-pressed": String(this.activeTab === source),
      },
    });
    setIcon(button, icon);
    button.addEventListener("click", () => {
      this.activeTab = source;
      this.renderInput();
    });
  }

  private renderTextSource(container: HTMLElement): void {
    const textarea = container.createEl("textarea", {
      cls: "mdfy-source-text",
      attr: { placeholder: "Paste text or Markdown…", "aria-label": "Source text" },
    });
    textarea.rows = 12;
    textarea.value = this.text;
    textarea.addEventListener("input", () => {
      this.text = textarea.value;
    });
  }

  private renderUrlSource(container: HTMLElement): void {
    container.createEl("p", {
      cls: "setting-item-description",
      text: "Mdfy extracts public, static HTML articles. JavaScript-only and authenticated pages are not supported.",
    });
    const input = new TextComponent(container)
      .setPlaceholder("https://example.com/article")
      .setValue(this.url)
      .onChange((value) => {
        this.url = value;
      });
    input.inputEl.addClass("mdfy-url-input");
    input.inputEl.setAttribute("aria-label", "Article URL");
  }

  private renderImageSource(container: HTMLElement): void {
    container.createEl("p", {
      cls: "setting-item-description",
      text: "Add up to 10 JPEG, PNG, WebP, or HEIC images in reading order. HEIC is converted locally to JPEG. The selected model must support vision.",
    });

    const picker = container.createEl("input", {
      type: "file",
      attr: { accept: "image/jpeg,image/png,image/webp,.heic", multiple: "true" },
    });
    picker.addEventListener("change", () => {
      void this.addFiles(Array.from(picker.files ?? []));
    });

    const pasteZone = container.createDiv({
      cls: "mdfy-paste-zone",
      text: "Paste screenshots with Ctrl/Cmd+V or drop images here",
      attr: { tabindex: "0" },
    });
    pasteZone.addEventListener("paste", (event) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/") || /\.heic$/i.test(file.name));
      if (files.length > 0) {
        event.preventDefault();
        void this.addFiles(files);
      }
    });
    pasteZone.addEventListener("dragenter", (event) => {
      event.preventDefault();
      pasteZone.addClass("is-dragging");
    });
    pasteZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      pasteZone.addClass("is-dragging");
    });
    pasteZone.addEventListener("dragleave", () => pasteZone.removeClass("is-dragging"));
    pasteZone.addEventListener("drop", (event) => {
      event.preventDefault();
      pasteZone.removeClass("is-dragging");
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) void this.addFiles(files);
    });

    const list = container.createDiv({ cls: "mdfy-image-list" });
    this.images.forEach((image, index) => this.renderImageItem(list, image, index));
  }

  private renderFileSource(container: HTMLElement): void {
    container.createEl("p", {
      cls: "setting-item-description",
      text: "Choose one TXT, MD, PDF, DOCX, or PPTX file (up to 20 MB). TXT and MD use Chat Completions; PDF, DOCX, and PPTX require your provider's Responses API.",
    });
    const picker = container.createEl("input", {
      type: "file",
      attr: {
        accept: ".txt,.md,.pdf,.docx,.pptx",
        "aria-label": "Choose a TXT, MD, PDF, DOCX, or PPTX file",
      },
    });
    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      if (!file) return;
      try {
        if (isTextFile(file)) validateTextFile(file);
        else validateDocumentFile(file);
        this.documentFile = file;
        this.renderInput();
      } catch (error) {
        new Notice(errorMessage(error));
        picker.value = "";
      }
    });
    if (this.documentFile) {
      const item = container.createDiv({ cls: "mdfy-file-item" });
      item.createEl("span", { text: `${this.documentFile.name} · ${formatBytes(this.documentFile.size)}` });
      const remove = item.createEl("button", { text: "Remove", attr: { "aria-label": "Remove selected file" } });
      remove.addEventListener("click", () => {
        this.documentFile = null;
        this.renderInput();
      });
    }
  }

  private renderImageItem(container: HTMLElement, image: ImageAsset, index: number): void {
    const item = container.createDiv({ cls: "mdfy-image-item" });
    item.createEl("img", { attr: { src: image.dataUrl, alt: "" } });
    const details = item.createDiv({ cls: "mdfy-image-details" });
    details.createEl("strong", { text: `${index + 1}. ${image.name}` });
    details.createEl("span", { text: formatBytes(image.size) });

    const actions = item.createDiv({ cls: "mdfy-image-actions" });
    this.imageAction(actions, "↑", "Move image up", index === 0, () => this.moveImage(index, -1));
    this.imageAction(actions, "↓", "Move image down", index === this.images.length - 1, () =>
      this.moveImage(index, 1),
    );
    this.imageAction(actions, "Remove", `Remove ${image.name}`, false, () => {
      this.images.splice(index, 1);
      this.renderInput();
    });
  }

  private imageAction(
    container: HTMLElement,
    text: string,
    label: string,
    disabled: boolean,
    action: () => void,
  ): void {
    const button = container.createEl("button", { text, attr: { "aria-label": label } });
    button.disabled = disabled;
    button.addEventListener("click", action);
  }

  private moveImage(index: number, offset: -1 | 1): void {
    const target = index + offset;
    if (target < 0 || target >= this.images.length) return;
    const [image] = this.images.splice(index, 1);
    if (image) this.images.splice(target, 0, image);
    this.renderInput();
  }

  private async addFiles(files: File[]): Promise<void> {
    try {
      const additions: ImageAsset[] = [];
      for (const file of files) additions.push(await fileToImageAsset(file));
      validateImages([...this.images, ...additions]);
      this.images.push(...additions);
      this.renderInput();
    } catch (error) {
      new Notice(errorMessage(error));
    }
  }

  private async generate(button: HTMLButtonElement, status: HTMLElement): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    button.disabled = true;
    button.setText("Generating…");
    const startedAt = performance.now();
    let phase = this.activeTab === "url" ? "Extracting article" : this.activeTab === "file" ? "Reading file" : "Preparing request";
    status.setText(`${phase}…`);
    const timer = window.setInterval(() => {
      status.setText(`${phase}… ${formatSeconds(performance.now() - startedAt, true)}`);
    }, 1_000);

    try {
      this.validateConfiguration();
      const source = await this.prepareSource();
      const sourceReadyAt = performance.now();
      const prompt = buildPrompt({
        source,
        currentNote: this.useNoteContext
          ? this.activeTab === "text" && this.context.selection
            ? this.context.noteWithoutSelection
            : this.context.noteContent
          : undefined,
        additionalInstruction: this.additionalInstruction,
      });
      validateTextLength(prompt.textLength, this.settings.maxInputCharacters);
      phase = "Waiting for the model";
      status.setText(`${phase}… ${formatSeconds(performance.now() - startedAt, true)}`);
      this.result = await this.client.complete(this.settings, this.getApiKey(), prompt);
      const finishedAt = performance.now();
      this.timingSummary = `Source: ${formatSeconds(sourceReadyAt - startedAt)} · Model: ${formatSeconds(finishedAt - sourceReadyAt)} · Total: ${formatSeconds(finishedAt - startedAt)}`;
      this.renderResult();
    } catch (error) {
      const message = errorMessage(error);
      status.setText(message);
      new Notice(message);
    } finally {
      window.clearInterval(timer);
      this.busy = false;
      button.disabled = false;
      button.setText("Generate Markdown");
    }
  }

  private async prepareSource(): Promise<PromptSource> {
    switch (this.activeTab) {
      case "text": {
        if (!this.text.trim()) throw new SourceValidationError("Paste some source text first.");
        return { kind: "text", text: this.text };
      }
      case "images": {
        validateImages(this.images);
        return { kind: "images", images: [...this.images] };
      }
      case "url": {
        if (!this.url.trim()) throw new SourceValidationError("Enter an article URL first.");
        return this.articleExtractor.extract(this.url);
      }
      case "file": {
        if (!this.documentFile) throw new SourceValidationError("Choose a TXT, MD, PDF, DOCX, or PPTX file first.");
        if (isTextFile(this.documentFile)) return fileToTextSource(this.documentFile);
        return { kind: "file", file: await fileToDocumentAsset(this.documentFile) };
      }
    }
  }

  private validateConfiguration(): void {
    if (!this.settings.baseUrl.trim()) throw new SourceValidationError("Configure an API base URL in Mdfy settings.");
    if (!this.settings.model.trim()) throw new SourceValidationError("Configure a model in Mdfy settings.");
  }

  private renderResult(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Markdown preview" });
    contentEl.createEl("p", { cls: "mdfy-timing", text: this.timingSummary });
    const textarea = contentEl.createEl("textarea", {
      cls: "mdfy-result",
      attr: { "aria-label": "Generated Markdown" },
    });
    textarea.rows = 18;
    textarea.value = this.result;
    textarea.addEventListener("input", () => {
      this.result = textarea.value;
    });

    const footer = contentEl.createDiv({ cls: "mdfy-result-actions" });
    const back = footer.createEl("button", { text: "Back" });
    back.addEventListener("click", () => this.renderInput());

    const copy = footer.createEl("button", { text: "Copy" });
    copy.addEventListener("click", () => void this.copyResult());

    if (this.context.selection) {
      const replace = footer.createEl("button", { text: "Replace selection" });
      replace.addEventListener("click", () => {
        try {
          replaceOriginalSelection(this.context, this.result);
          this.close();
        } catch (error) {
          new Notice(errorMessage(error));
        }
      });
    }

    const insert = footer.createEl("button", { cls: "mod-cta", text: "Insert at cursor" });
    insert.addEventListener("click", () => {
      insertAtCursor(this.context, this.result);
      this.close();
    });
  }

  private async copyResult(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.result);
      new Notice("Markdown copied.");
    } catch {
      new Notice("Could not copy Markdown to the clipboard.");
    }
  }
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Mdfy could not complete the request.";
}

function formatSeconds(milliseconds: number, whole = false): string {
  return `${whole ? Math.floor(milliseconds / 1_000) : (milliseconds / 1_000).toFixed(1)} s`;
}
