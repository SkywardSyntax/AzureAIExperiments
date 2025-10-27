import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
export const GENERATED_DIR = path.join(process.cwd(), "generated");

export async function ensureDirectories() {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await mkdir(GENERATED_DIR, { recursive: true });
}

export async function saveBuffer(
  buffer: Buffer,
  destinationDir: string,
  filename: string,
) {
  await mkdir(destinationDir, { recursive: true });
  const fullPath = path.join(destinationDir, filename);
  await writeFile(fullPath, buffer);
  return fullPath;
}
