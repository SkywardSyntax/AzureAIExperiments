import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph } from "docx";
import { GENERATED_DIR, ensureDirectories } from "@/lib/fsUtils";

type DocumentType = "pdf" | "docx" | "txt" | "csv" | "md";

interface CreateDocumentInput {
  filename: string;
  type: DocumentType;
  content: string;
}

export interface DocumentCreationResult {
  id: string;
  filename: string;
  type: DocumentType;
  storedFilename: string;
  fullPath: string;
}

const EXTENSION_MAP: Record<DocumentType, string> = {
  pdf: ".pdf",
  docx: ".docx",
  txt: ".txt",
  csv: ".csv",
  md: ".md",
};

export async function createDocumentFile({
  filename,
  type,
  content,
}: CreateDocumentInput): Promise<DocumentCreationResult> {
  await ensureDirectories();

  const id = randomUUID();
  const ext = EXTENSION_MAP[type];
  const safeBase = filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120) || "azure-ai-document";
  const finalFilename = `${safeBase}${ext}`;
  const storedFilename = `${id}-${finalFilename}`;
  const destination = path.join(GENERATED_DIR, storedFilename);

  const buffer = await createBufferForType(type, content);
  await writeFile(destination, buffer);

  return {
    id,
    filename: finalFilename,
    type,
    storedFilename,
    fullPath: destination,
  };
}

async function createBufferForType(type: DocumentType, content: string) {
  switch (type) {
    case "pdf": {
      return renderPdf(content);
    }
    case "docx": {
      return renderDocx(content);
    }
    default: {
      return Buffer.from(content, "utf-8");
    }
  }
}

async function renderPdf(content: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    doc.font("Helvetica").fontSize(12).text(content, {
      align: "left",
    });

    doc.end();
  });
}

async function renderDocx(content: string): Promise<Buffer> {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((block) => new Paragraph(block.trim()));

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs.length ? paragraphs : [new Paragraph(content)],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
