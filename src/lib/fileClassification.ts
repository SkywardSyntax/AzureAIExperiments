const TEXT_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/xml",
  "application/yaml",
];

const TEXT_EXTENSIONS = [".md", ".csv", ".tsv", ".log"];

export function isTextLikeFile(
  mimeType: string | null,
  filename: string,
): boolean {
  if (!mimeType) {
    return TEXT_EXTENSIONS.some((ext) => filename.endsWith(ext));
  }

  if (mimeType.startsWith("text/")) {
    return true;
  }

  return TEXT_MIME_PREFIXES.includes(mimeType);
}

export function isImage(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/");
}
