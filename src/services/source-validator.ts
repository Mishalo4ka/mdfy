import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  MAX_TOTAL_IMAGE_BYTES,
  MAX_DOCUMENT_BYTES,
  DOCUMENT_MIME_TYPES,
  SUPPORTED_IMAGE_TYPES,
  type DocumentAsset,
  type ImageAsset,
  type TextSource,
} from "../types";

export class SourceValidationError extends Error {}

export function validateHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SourceValidationError("Enter a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SourceValidationError("Only HTTP and HTTPS URLs are supported.");
  }
  return url;
}

export function validateImages(images: readonly ImageAsset[]): void {
  if (images.length === 0) {
    throw new SourceValidationError("Add at least one image.");
  }
  if (images.length > MAX_IMAGE_COUNT) {
    throw new SourceValidationError(`You can add up to ${MAX_IMAGE_COUNT} images.`);
  }

  let totalBytes = 0;
  for (const image of images) {
    if (!SUPPORTED_IMAGE_TYPES.includes(image.mimeType)) {
      throw new SourceValidationError(`${image.name} is not a JPEG, PNG, or WebP image.`);
    }
    if (image.size > MAX_IMAGE_BYTES) {
      throw new SourceValidationError(`${image.name} is larger than 10 MB.`);
    }
    totalBytes += image.size;
  }

  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    throw new SourceValidationError("The combined image size is larger than 30 MB.");
  }
}

export function validateTextLength(length: number, maximum: number): void {
  if (length > maximum) {
    throw new SourceValidationError(
      `The text input is ${length.toLocaleString()} characters, above the configured ${maximum.toLocaleString()} character limit. Disable note context, shorten the source, or increase the limit in settings.`,
    );
  }
}

export function validateDocumentFile(file: File): DocumentAsset["mimeType"] {
  const extension = file.name.toLowerCase().split(".").pop();
  if (!extension || !(extension in DOCUMENT_MIME_TYPES)) {
    throw new SourceValidationError("Choose a PDF, DOCX, or PPTX file.");
  }
  if (file.size === 0) throw new SourceValidationError("The selected file is empty.");
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new SourceValidationError("The file is larger than 20 MB.");
  }
  return DOCUMENT_MIME_TYPES[extension as keyof typeof DOCUMENT_MIME_TYPES];
}

export function isTextFile(file: File): boolean {
  return /\.(txt|md)$/i.test(file.name);
}

export function validateTextFile(file: File): void {
  if (!isTextFile(file)) throw new SourceValidationError("Choose a TXT or MD file.");
  if (file.size === 0) throw new SourceValidationError("The selected file is empty.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new SourceValidationError("The file is larger than 20 MB.");
}

export async function fileToTextSource(file: File): Promise<TextSource> {
  validateTextFile(file);
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new SourceValidationError(`Could not read ${file.name}.`));
    reader.readAsArrayBuffer(file);
  });
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    throw new SourceValidationError(`${file.name} is not valid UTF-8 text.`);
  }
  if (!text.trim()) throw new SourceValidationError("The selected file contains no text.");
  return { kind: "text", name: file.name, text };
}

export async function fileToDocumentAsset(file: File): Promise<DocumentAsset> {
  const mimeType = validateDocumentFile(file);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new SourceValidationError(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
  const encoded = dataUrl.split(",", 2)[1];
  if (!encoded) throw new SourceValidationError(`Could not read ${file.name}.`);
  return {
    name: file.name,
    mimeType,
    size: file.size,
    dataUrl: `data:${mimeType};base64,${encoded}`,
  };
}

export async function fileToImageAsset(file: File): Promise<ImageAsset> {
  const heic = /\.heic$/i.test(file.name) || file.type === "image/heic";
  if (!heic && !SUPPORTED_IMAGE_TYPES.includes(file.type as ImageAsset["mimeType"])) {
    throw new SourceValidationError(`${file.name} is not a JPEG, PNG, WebP, or HEIC image.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new SourceValidationError(`${file.name} is larger than 10 MB.`);
  }

  let image = file;
  if (heic) {
    try {
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const jpeg = Array.isArray(converted) ? converted[0] : converted;
      if (!jpeg?.size) throw new Error("No image produced");
      image = new File([jpeg], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
    } catch {
      throw new SourceValidationError(`Could not convert ${file.name} from HEIC to JPEG.`);
    }
    if (image.size > MAX_IMAGE_BYTES) throw new SourceValidationError(`${file.name} is larger than 10 MB after conversion.`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new SourceValidationError(`Could not read ${file.name}.`));
    reader.readAsDataURL(image);
  });

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: file.name || "Clipboard image",
    mimeType: image.type as ImageAsset["mimeType"],
    size: image.size,
    dataUrl,
  };
}
