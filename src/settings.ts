import { Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type MdfyPlugin from "./main";
import type { MdfySettings } from "./types";

export const DEFAULT_SETTINGS: MdfySettings = {
  baseUrl: "https://api.openai.com/v1",
  model: "",
  secretName: "",
  maxInputCharacters: 60_000,
  maxOutputTokens: 4_096,
  timeoutSeconds: 120,
};

export class MdfySettingTab extends PluginSettingTab {
  constructor(private readonly plugin: MdfyPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Mdfy settings" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Requests go directly from Obsidian to the configured provider. Mdfy has no server or telemetry.",
    });

    new Setting(containerEl)
      .setName("API base URL")
      .setDesc("OpenAI-compatible base URL, usually ending in /v1.")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.baseUrl = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Exact model name exposed by the configured endpoint.")
      .addText((text) =>
        text.setPlaceholder("Model name").setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("API key")
      .setDesc("Select or create a secret in Obsidian SecretStorage. Optional for local endpoints.")
      .addComponent((element) =>
        new SecretComponent(this.app, element)
          .setValue(this.plugin.settings.secretName)
          .onChange(async (value) => {
            this.plugin.settings.secretName = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Maximum input characters")
      .setDesc("Applies to source text, article text, note context, and the additional instruction.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1000";
        text.setValue(String(this.plugin.settings.maxInputCharacters)).onChange(async (value) => {
          this.plugin.settings.maxInputCharacters = validInteger(value, 1_000, 2_000_000, 60_000);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Maximum output tokens")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(this.plugin.settings.maxOutputTokens)).onChange(async (value) => {
          this.plugin.settings.maxOutputTokens = validInteger(value, 1, 100_000, 4_096);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Request timeout")
      .setDesc("Seconds to wait before reporting a timeout.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "5";
        text.setValue(String(this.plugin.settings.timeoutSeconds)).onChange(async (value) => {
          this.plugin.settings.timeoutSeconds = validInteger(value, 5, 600, 120);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Test connection")
      .setDesc("Sends a minimal Chat Completions request to the selected model.")
      .addButton((button) =>
        button.setButtonText("Test").onClick(async () => {
          button.setDisabled(true).setButtonText("Testing…");
          try {
            await this.plugin.testConnection();
            new Notice("Mdfy connected successfully.");
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "Connection test failed.");
          } finally {
            button.setDisabled(false).setButtonText("Test");
          }
        }),
      );
  }
}

function validInteger(value: string, minimum: number, maximum: number, fallback: number): number {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}
