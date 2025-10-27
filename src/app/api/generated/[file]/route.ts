import { NextRequest } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { GENERATED_DIR } from "@/lib/fsUtils";

export const runtime = "nodejs";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { file: string } },
) {
  const storedFilename = params.file;
  const fullPath = path.join(GENERATED_DIR, storedFilename);

  if (!fullPath.startsWith(GENERATED_DIR)) {
    return new Response("Invalid file path", { status: 400 });
  }

  try {
    await stat(fullPath);
  } catch {
    return new Response("File not found", { status: 404 });
  }

  const extension = path.extname(storedFilename).toLowerCase();
  const mimeType = MIME_MAP[extension] ?? "application/octet-stream";
  const fileBuffer = await readFile(fullPath);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${storedFilename.replace(
        /^[^-]+-/,
        "",
      )}"`,
    },
  });
}
