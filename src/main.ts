import { MarkdownView, Notice, Plugin, requestUrl, type Editor } from "obsidian";
import { captureEditorContext } from "./editor-actions";
import { MdfySettingTab, DEFAULT_SETTINGS } from "./settings";
import { ArticleExtractor } from "./services/article-extractor";
import type { HttpRequest, HttpResponse } from "./services/http";
import { OpenAiCompatibleClient } from "./services/openai-client";
import type { MdfySettings } from "./types";
import { MdfyModal } from "./ui/mdfy-modal";

export default class MdfyPlugin extends Plugin {
  settings: MdfySettings = { ...DEFAULT_SETTINGS };
  private readonly requester = async (request: HttpRequest): Promise<HttpResponse> => requestUrl(request);
  private readonly articleExtractor = new ArticleExtractor(this.requester);
  private readonly client = new OpenAiCompatibleClient(this.requester);

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new MdfySettingTab(this));

    this.addCommand({
      id: "open-mdfy",
      name: "Open Mdfy",
      editorCallback: (editor) => this.openModal(editor),
    });

    this.addRibbonIcon("wand-sparkles", "Open Mdfy", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        new Notice("Open a Markdown note before using Mdfy.");
        return;
      }
      this.openModal(view.editor);
    });
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<MdfySettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getApiKey(): string | null {
    if (!this.settings.secretName) return null;
    return this.app.secretStorage.getSecret(this.settings.secretName);
  }

  async testConnection(): Promise<void> {
    if (!this.settings.baseUrl.trim()) throw new Error("Configure an API base URL first.");
    if (!this.settings.model.trim()) throw new Error("Configure a model first.");
    await this.client.testConnection(this.settings, this.getApiKey());
  }

  private openModal(editor: Editor): void {
    const context = captureEditorContext(editor);
    new MdfyModal(this.app, {
      context,
      settings: this.settings,
      articleExtractor: this.articleExtractor,
      client: this.client,
      getApiKey: () => this.getApiKey(),
    }).open();
  }
}
