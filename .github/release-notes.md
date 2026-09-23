Mdfy turns text, images, files, and public articles into Markdown inside Obsidian using your own OpenAI-compatible API.

### What's new in 0.2.0

- Upload UTF-8 TXT and MD files through Chat Completions.
- Upload PDF, DOCX, and PPTX files through the Responses API when your provider and model support file input.
- Add HEIC photos; Mdfy converts the first frame to JPEG locally before sending it to your vision model.
- Source buttons now appear in Text → URL → Images → Files order, and the live timer shows whole seconds.

### Install in Obsidian

1. Under **Assets** below, download **`main.js`**, **`manifest.json`**, and **`styles.css`**. The source code archives are not the plugin installation files.
2. Open your Obsidian vault folder and create `.obsidian/plugins/mdfy/` inside it. The `.obsidian` folder may be hidden.
3. Put all three downloaded files directly in `mdfy/` and restart Obsidian.
4. Open **Settings → Community plugins**. Turn on community plugins if needed, then enable **Mdfy** under installed plugins.
5. Open **Settings → Community plugins → Mdfy**. Set the API base URL and model, add an API key through SecretStorage if your endpoint needs one, and select **Test connection**.

This release is for desktop Obsidian. Image input requires a vision-capable model. PDF, DOCX, and PPTX require Responses API file-input support; **Test connection** checks Chat Completions only. Mdfy is not yet listed in the Community plugins directory, so it must be installed manually.

For screenshots, usage, privacy details, and updates, see the [README](https://github.com/Mishalo4ka/mdfy#readme).
