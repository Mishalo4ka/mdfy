# Mdfy

Mdfy turns text, screenshots, slide photos, and public articles into clean Markdown without leaving Obsidian. It uses your own OpenAI-compatible endpoint and can follow the structure and terminology of the note you are editing.

## Features

- Format pasted text or existing Markdown.
- Start from text selected in the current note; Mdfy fills the Text source automatically.
- Process up to 10 ordered JPEG, PNG, or WebP images with a vision-capable model.
- Extract the readable content of public, static HTML articles.
- Use the current note as optional style and deduplication context.
- Add a one-off instruction such as “summarize this” or “make a table”.
- Review and edit the result before inserting, replacing a selection, or copying it.
- Connect directly to OpenAI-compatible Chat Completions APIs, including local endpoints that do not require a key.

## Requirements

- Obsidian 1.11.4 or newer on desktop.
- An OpenAI-compatible `/chat/completions` endpoint.
- A vision-capable model for image input.

## Install

Mdfy is not yet listed in Obsidian's Community plugins directory, so install this release manually:

1. Open the [latest release](https://github.com/Mishalo4ka/mdfy/releases/latest) and download **`main.js`**, **`manifest.json`**, and **`styles.css`** from **Assets**. Do not download the source code archive instead.
2. Open your Obsidian vault folder. Inside it, create `.obsidian/plugins/mdfy/` if it does not already exist. The `.obsidian` folder may be hidden in your file manager.
3. Put all three downloaded files directly in `mdfy/`, so the paths end with `mdfy/main.js`, `mdfy/manifest.json`, and `mdfy/styles.css`.
4. Restart Obsidian. Open **Settings → Community plugins**, turn on community plugins if needed, and enable **Mdfy** under installed plugins.
5. Open **Settings → Community plugins → Mdfy** to enter your API base URL and model, then select or create an API key in Obsidian SecretStorage. Use **Test connection** to check the settings.

To update a manual installation, replace the same three files with the files from a newer release and restart Obsidian.

## Build from source

```bash
npm install
npm run build
```

Copy `manifest.json`, `main.js`, and `styles.css` into `<vault>/.obsidian/plugins/mdfy/`, then enable **Mdfy** in **Settings → Community plugins**. During development, `npm run dev` watches and rebuilds `main.js`.

## Configure

Open **Settings → Community plugins → Mdfy** and set:

1. The API base URL, usually ending in `/v1`.
2. The exact model name exposed by the endpoint.
3. An API key selected through Obsidian SecretStorage, unless the endpoint does not require one.

Use **Test connection** to verify the configuration. The test sends a minimal Chat Completions request and may incur a small provider charge.

## Use

Open a Markdown note and choose **Mdfy: Open Mdfy** from the command palette, assign a hotkey, or use the ribbon icon. Choose Text, Images, or URL, optionally add an instruction, and generate Markdown. If you select text before opening Mdfy, it fills the Text source, and the selected passage is excluded from the note context so the model can rewrite it. Images can be selected, pasted, or dropped into the image area. Nothing is written to the note until you choose an insertion action.

Article extraction supports public HTML returned by the server. It does not run page JavaScript, bypass authentication or paywalls, or process PDF files.

## Privacy

Mdfy has no backend, accounts, analytics, or telemetry. Requests go directly from Obsidian to the endpoint you configure. Depending on your choices, a request can contain:

- the source text, images, or extracted article;
- your additional instruction;
- the complete active note when **Use current note as context** is enabled.

API keys are referenced through Obsidian SecretStorage and are not stored in Mdfy's `data.json`. Your provider's privacy, retention, and pricing policies apply to every request.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Release

Run `npm version patch`, `npm version minor`, or `npm version major` to keep `package.json`, `manifest.json`, and `versions.json` synchronized. Push the generated version tag without a `v` prefix. The release workflow verifies the tag, rebuilds the plugin, and publishes `manifest.json`, `main.js`, and `styles.css` as GitHub Release assets.

## License

[MIT](LICENSE)
