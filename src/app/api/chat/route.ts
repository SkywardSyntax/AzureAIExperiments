import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";
import { azureClient, defaultDeployment } from "@/lib/azureClient";
import { UPLOAD_DIR, ensureDirectories } from "@/lib/fsUtils";
import {
  Artifact,
  ChatRequestPayload,
  ChatResponsePayload,
  GeneratedFile,
  UploadedFileMetadata,
} from "@/lib/types";
import { createDocumentFile } from "@/lib/documentFactory";
import { isTextLikeFile } from "@/lib/fileClassification";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attachmentSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  storedFilename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  publicUrl: z.string(),
  category: z.union([
    z.literal("image"),
    z.literal("text"),
    z.literal("other"),
  ]),
  textPreview: z.string().optional(),
});

const messageSchema = z.object({
  id: z.string(),
  role: z.union([z.literal("system"), z.literal("user"), z.literal("assistant")]),
  text: z.string().min(1),
  attachments: z.array(attachmentSchema).optional(),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
});

const artifactArgsSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().optional(),
  html: z.string().min(1),
  css: z.string().optional(),
  js: z.string().optional(),
});

const documentArgsSchema = z.object({
  filename: z.string().min(1),
  type: z.union([
    z.literal("pdf"),
    z.literal("docx"),
    z.literal("txt"),
    z.literal("csv"),
    z.literal("md"),
  ]),
  content: z.string().min(1),
  summary: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
    return NextResponse.json(
      { error: "Azure OpenAI environment variables are not configured." },
      { status: 500 },
    );
  }

  await ensureDirectories();

  let body: ChatRequestPayload;

  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Unable to parse request payload." },
      { status: 400 },
    );
  }

  try {
    const { response, artifacts, generatedFiles } =
      await runResponsesCall(body);

    const assistantText = extractAssistantText(response) ?? "";

    const chatMessage: ChatResponsePayload["message"] = {
      id: randomUUID(),
      role: "assistant",
      text: assistantText,
      createdAt: new Date().toISOString(),
      artifacts,
      generatedFiles,
    };

    return NextResponse.json({ message: chatMessage }, { status: 200 });
  } catch (error) {
    console.error("[chat] Azure call failed", error);
    return NextResponse.json(
      {
        error: "Failed to generate a response from Azure OpenAI.",
        details:
          error instanceof Error ? { message: error.message } : undefined,
      },
      { status: 500 },
    );
  }
}

async function runResponsesCall(body: ChatRequestPayload) {
  const tools = getFunctionTools();
  const azureInput = await buildAzureInput(body.messages);

  let response = await azureClient.responses.create({
    model: defaultDeployment,
    input: azureInput,
    temperature: body.temperature ?? 0.4,
    tools,
  });

  const artifacts: Artifact[] = [];
  const generatedFiles: GeneratedFile[] = [];

  let toolCallOutputs = await handleToolCalls(response, artifacts, generatedFiles);

  while (toolCallOutputs.length) {
    response = await azureClient.responses.create({
      model: defaultDeployment,
      previous_response_id: response.id,
      input: toolCallOutputs,
    });

    toolCallOutputs = await handleToolCalls(response, artifacts, generatedFiles);
  }

  return { response, artifacts, generatedFiles };
}

async function handleToolCalls(
  response: OpenAIResponse,
  artifacts: Artifact[],
  generatedFiles: GeneratedFile[],
) {
  const toolOutputs: Array<{
    type: "function_call_output";
    call_id: string;
    output: string;
  }> = [];

  for (const output of response.output ?? []) {
    if (output.type !== "function_call") {
      continue;
    }

    const { name, call_id, arguments: args } = output;

    if (!call_id) {
      continue;
    }

    if (name === "create_artifact") {
      const result = await executeCreateArtifact(args ?? "{}", artifacts);
      toolOutputs.push({
        type: "function_call_output",
        call_id,
        output: JSON.stringify(result),
      });
    } else if (name === "create_document") {
      const result = await executeCreateDocument(args ?? "{}", generatedFiles);
      toolOutputs.push({
        type: "function_call_output",
        call_id,
        output: JSON.stringify(result),
      });
    } else {
      toolOutputs.push({
        type: "function_call_output",
        call_id,
        output: JSON.stringify({
          error: `Unknown function: ${name}`,
        }),
      });
    }
  }

  return toolOutputs;
}

async function executeCreateArtifact(rawArgs: string, artifacts: Artifact[]) {
  const jsonArgs = safeJsonParse(rawArgs);
  const parsed = artifactArgsSchema.safeParse(jsonArgs ?? {});

  if (!parsed.success) {
    const errorDetail = parsed.error.flatten().fieldErrors;
    return { success: false, error: "Invalid artifact arguments", errorDetail };
  }

  const { html, css, js, title, description } = parsed.data;

  const previewHtml = sanitizeHtml(
    `<style>${css ?? ""}</style>${html}`,
    {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "svg",
        "path",
        "circle",
        "line",
        "polyline",
        "polygon",
        "style",
        "canvas",
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": (sanitizeHtml.defaults.allowedAttributes["*"] ?? []).concat([
          "style",
          "class",
          "id",
          "data-*",
        ]),
      },
    },
  );

  const fullHtml = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8" />',
    "<style>",
    css ?? "",
    "</style>",
    "</head>",
    "<body>",
    html,
    js
      ? `<script type="module">\n${js}\n</script>`
      : "",
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");

  const artifact: Artifact = {
    id: randomUUID(),
    title,
    description,
    previewHtml,
    fullHtml,
  };

  artifacts.push(artifact);

  return { success: true, artifactId: artifact.id };
}

async function executeCreateDocument(
  rawArgs: string,
  generatedFiles: GeneratedFile[],
) {
  const jsonArgs = safeJsonParse(rawArgs);
  const parsed = documentArgsSchema.safeParse(jsonArgs ?? {});

  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid document arguments",
      errorDetail: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await createDocumentFile(parsed.data);
  const downloadUrl = `/api/generated/${result.storedFilename}`;

  const generated: GeneratedFile = {
    id: result.id,
    filename: result.filename,
    type: result.type,
    storedFilename: result.storedFilename,
    downloadUrl,
    summary: parsed.data.summary,
  };

  generatedFiles.push(generated);

  return {
    success: true,
    fileId: result.id,
    downloadUrl,
    filename: result.filename,
  };
}

async function buildAzureInput(messages: ChatRequestPayload["messages"]) {
  const azureMessages: Array<Record<string, unknown>> = [];

  for (const message of messages) {
    const contentParts: Array<Record<string, unknown>> = [];

    if (message.role === "assistant") {
      contentParts.push({
        type: "output_text",
        text: message.text,
      });
    } else {
      contentParts.push({
        type: "input_text",
        text: message.text,
      });
    }

    if (message.attachments?.length) {
      const attachmentParts = await Promise.all(
        message.attachments.map((attachment) =>
          mapAttachmentToContentPart(attachment),
        ),
      );
      contentParts.push(...attachmentParts);
    }

    azureMessages.push({
      role: message.role,
      content: contentParts,
    });
  }

  return azureMessages;
}

async function mapAttachmentToContentPart(
  attachment: UploadedFileMetadata,
): Promise<Record<string, unknown>> {
  const fullPath = path.join(UPLOAD_DIR, attachment.storedFilename);
  let fileBuffer: Buffer;

  try {
    fileBuffer = await readFile(fullPath);
  } catch (error) {
    console.warn(
      `[chat] Failed to read attachment ${attachment.storedFilename}`,
      error,
    );
    return {
      type: "input_text",
      text: `Attachment "${attachment.originalName}" could not be loaded from the server.`,
    };
  }

  if (attachment.category === "image") {
    const base64 = fileBuffer.toString("base64");
    return {
      type: "input_image",
      image_url: `data:${attachment.mimeType};base64,${base64}`,
    };
  }

  if (attachment.category === "text" || isTextLikeFile(attachment.mimeType, attachment.originalName)) {
    const text = fileBuffer.toString("utf-8");
    const structured = [
      `File Name: ${attachment.originalName}`,
      `MIME Type: ${attachment.mimeType}`,
      "",
      "Contents:",
      text,
    ].join("\n");
    return {
      type: "input_text",
      text: structured,
    };
  }

  return {
    type: "input_text",
    text: `Attached file "${attachment.originalName}" (${attachment.mimeType}, ${attachment.size} bytes) is stored at ${attachment.publicUrl}. Describe how you want to handle this file.`,
  };
}

function extractAssistantText(response: OpenAIResponse) {
  for (const output of response.output ?? []) {
    if (output.type !== "message") continue;
    for (const content of output.content ?? []) {
      if (content.type === "output_text") {
        return content.text ?? "";
      }
    }
  }
  return "";
}

function getFunctionTools() {
  return [
    {
      type: "function",
      name: "create_artifact",
      description:
        "Create an interactive micro-application that can run client-side inside a sandboxed iframe. Provide the HTML, CSS, and optional JavaScript needed.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short name for the artifact card.",
          },
          description: {
            type: "string",
            description: "Optional description for the artifact preview.",
          },
          html: {
            type: "string",
            description:
              "Body markup for the micro-application. Keep it self-contained.",
          },
          css: {
            type: "string",
            description:
              "Optional CSS to style the artifact. Avoid global resets.",
          },
          js: {
            type: "string",
            description:
              "Optional JavaScript that should run when the artifact loads.",
          },
        },
        required: ["title", "html"],
      },
    },
    {
      type: "function",
      name: "create_document",
      description:
        "Create a downloadable document (PDF, DOCX, TXT, CSV, or Markdown) from the provided textual content.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description:
              "Base filename for the generated document without extension.",
          },
          type: {
            type: "string",
            enum: ["pdf", "docx", "txt", "csv", "md"],
            description: "File type to generate.",
          },
          content: {
            type: "string",
            description: "Raw textual content for the file.",
          },
          summary: {
            type: "string",
            description:
              "Optional short description of the generated document contents.",
          },
        },
        required: ["filename", "type", "content"],
      },
    },
  ];
}

function safeJsonParse(input: string): unknown | null {
  try {
    return input ? JSON.parse(input) : {};
  } catch {
    return null;
  }
}
