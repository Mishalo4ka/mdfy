Mdfy turns text, images, files, and public articles into Markdown inside Obsidian using your own OpenAI-compatible API.

### What's new in 0.2.2

- Insert generated Markdown at the current cursor position.
- Prevent replacing the original selection if the note changed before or within it. The result stays available to copy or insert instead.
- Reject unsupported document extensions that could previously pass validation.
- Simplify shared request handling and file reading, with expanded regression tests.

### Install in Obsidian

1. Under **Assets** below, download **`main.js`**, **`manifest.json`**, and **`styles.css`**. The source code archives are not the plugin installation files.
2. Open your Obsidian vault folder and create `.obsidian/plugins/mdfy/` inside it. The `.obsidian` folder may be hidden.
3. Put all three downloaded files directly in `mdfy/` and restart Obsidian.
4. Open **Settings → Community plugins**. Turn on community plugins if needed, then enable **Mdfy** under installed plugins.
5. Open **Settings → Community plugins → Mdfy**. Set the API base URL and model, add an API key through SecretStorage if your endpoint needs one, and select **Test connection**.

This release is for desktop Obsidian. Image input requires a vision-capable model. PDF, DOCX, and PPTX require Responses API file-input support; **Test connection** checks Chat Completions only. Mdfy is not yet listed in the Community plugins directory, so it must be installed manually.

Only import HEIC files you trust. The bundled decoder currently includes libheif 1.22.2, which has [published security advisories](https://github.com/strukturag/libheif/security/advisories); this patch does not update libheif itself.

The other assets provide license texts and the HEIC decoder's source code; they are not needed for installation because the required notices are also embedded in `main.js`.

For screenshots, usage, privacy details, and updates, see the [README](https://github.com/Mishalo4ka/mdfy#readme).
