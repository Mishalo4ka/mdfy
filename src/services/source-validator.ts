import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  MAX_TOTAL_IMAGE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  type ImageAsset,
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

export async function fileToImageAsset(file: File): Promise<ImageAsset> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as ImageAsset["mimeType"])) {
    throw new SourceValidationError(`${file.name} is not a JPEG, PNG, or WebP image.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new SourceValidationError(`${file.name} is larger than 10 MB.`);
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new SourceValidationError(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: file.name || "Clipboard image",
    mimeType: file.type as ImageAsset["mimeType"],
    size: file.size,
    dataUrl,
  };
}
