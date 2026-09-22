Mdfy turns text, images, and public articles into Markdown inside Obsidian using your own OpenAI-compatible API.

### Install in Obsidian

1. Under **Assets** below, download **`main.js`**, **`manifest.json`**, and **`styles.css`**. The source code archives are not the plugin installation files.
2. Open your Obsidian vault folder and create `.obsidian/plugins/mdfy/` inside it. The `.obsidian` folder may be hidden.
3. Put all three downloaded files directly in `mdfy/` and restart Obsidian.
4. Open **Settings → Community plugins**. Turn on community plugins if needed, then enable **Mdfy** under installed plugins.
5. Open **Settings → Community plugins → Mdfy**. Set the API base URL and model, add an API key through SecretStorage if your endpoint needs one, and select **Test connection**.

This release is for desktop Obsidian. Image input requires a vision-capable model. Mdfy is not yet listed in the Community plugins directory, so it must be installed manually.

For screenshots, usage, privacy details, and updates, see the [README](https://github.com/Mishalo4ka/mdfy#readme).
