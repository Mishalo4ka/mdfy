import type { Editor, EditorPosition } from "obsidian";

export const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_COUNT = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export interface TextSource {
  kind: "text";
  text: string;
  name?: string;
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

export interface DocumentAsset {
  name: string;
  mimeType: (typeof DOCUMENT_MIME_TYPES)[keyof typeof DOCUMENT_MIME_TYPES];
  size: number;
  dataUrl: string;
}

export interface DocumentSource {
  kind: "file";
  file: DocumentAsset;
}

export interface ArticleSource {
  kind: "article";
  url: string;
  title: string;
  byline?: string;
  markdown: string;
}

export type PromptSource = TextSource | ImageSource | ArticleSource | DocumentSource;

export interface PromptPayload {
  system: string;
  userText: string;
  images: ImageAsset[];
  file?: DocumentAsset;
  textLength: number;
}

export interface EditorContext {
  editor: Editor;
  noteContent: string;
  noteWithoutSelection: string;
  selection: string;
  selectionFrom: EditorPosition;
  selectionTo: EditorPosition;
  selectionPrefix: string;
}

export interface MdfySettings {
  baseUrl: string;
  model: string;
  secretName: string;
  maxInputCharacters: number;
  maxOutputTokens: number;
  timeoutSeconds: number;
}
