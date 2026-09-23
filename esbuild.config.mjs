import esbuild from "esbuild";
import { readFileSync } from "node:fs";
import process from "node:process";

const production = process.argv[2] === "production";
const legalTexts = ["LICENSE", "THIRD_PARTY_NOTICES.md", "licenses/heic-to-LGPL-3.0.txt", "licenses/GPL-3.0.txt"]
  .map((path) => readFileSync(new URL(path, import.meta.url), "utf8"))
  .join("\n\n");
if (legalTexts.includes("*/")) throw new Error("License text cannot be embedded in a JavaScript comment.");

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  banner: { js: `/*\nMdfy includes the LGPL-licensed HEIC decoder. The following notices and license texts accompany this bundle.\n\n${legalTexts}\n*/` },
  outfile: "main.js"
});

if (production) {
  await context.rebuild();
  await context.dispose();
} else {
  await context.watch();
}
