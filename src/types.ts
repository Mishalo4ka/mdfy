import type { Editor, EditorPosition } from "obsidian";

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_COUNT = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024;

export interface TextSource {
  kind: "text";
  text: string;
}

export interface ImageAsset {
  id: string;
  name: string;
  mimeType: (typeof SUPPORTED_IMAGE_TYPES)[number];
  size: number;
  dataUrl: string;
}

export interface ImageSource {
  kind: "images";
  images: ImageAsset[];
}

export interface UrlSource {
  kind: "url";
  url: string;
}

export type InputSource = TextSource | ImageSource | UrlSource;

export interface ArticleSource {
  kind: "article";
  url: string;
  title: string;
  byline?: string;
  markdown: string;
}

export type PromptSource = TextSource | ImageSource | ArticleSource;

export interface PromptPayload {
  system: string;
  userText: string;
  images: ImageAsset[];
  textLength: number;
}

export interface EditorContext {
  editor: Editor;
  noteContent: string;
  noteWithoutSelection: string;
  selection: string;
  selectionFrom: EditorPosition;
  selectionTo: EditorPosition;
  cursor: EditorPosition;
}

export interface MdfySettings {
  baseUrl: string;
  model: string;
  secretName: string;
  maxInputCharacters: number;
  maxOutputTokens: number;
  timeoutSeconds: number;
}
