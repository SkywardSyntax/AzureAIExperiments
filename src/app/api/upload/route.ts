import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ensureDirectories, saveBuffer, UPLOAD_DIR } from "@/lib/fsUtils";
import { isImage, isTextLikeFile } from "@/lib/fileClassification";
import { UploadedFileMetadata } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_PREVIEW = 8000;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const fileEntries = formData.getAll("files");

  if (!fileEntries.length) {
    return NextResponse.json(
      { error: "No files received under the `files` field." },
      { status: 400 },
    );
  }

  await ensureDirectories();

  const uploads: UploadedFileMetadata[] = [];

  for (const entry of fileEntries) {
    if (!(entry instanceof File)) {
      continue;
    }

    const safeOriginalName = path.basename(entry.name);
    const safeName = safeOriginalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileId = randomUUID();
    const storedFilename = `${fileId}-${safeName}`;

    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await saveBuffer(buffer, UPLOAD_DIR, storedFilename);

    let textPreview: string | undefined;
    const category = isImage(entry.type)
      ? "image"
      : isTextLikeFile(entry.type, safeOriginalName)
        ? "text"
        : "other";

    if (category === "text") {
      textPreview = buffer.toString("utf-8");
      if (textPreview.length > MAX_TEXT_PREVIEW) {
        textPreview = `${textPreview.slice(0, MAX_TEXT_PREVIEW)}\n...\n[truncated preview]`;
      }
    }

    uploads.push({
      id: fileId,
      originalName: safeOriginalName,
      storedFilename,
      mimeType: entry.type ?? "application/octet-stream",
      size: entry.size,
      publicUrl: `/uploads/${storedFilename}`,
      category,
      textPreview,
    });
  }

  return NextResponse.json({ files: uploads }, { status: 201 });
}
