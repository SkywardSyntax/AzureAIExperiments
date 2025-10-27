export type AttachmentCategory = "image" | "text" | "other";

export interface UploadedFileMetadata {
  id: string;
  originalName: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  publicUrl: string;
  category: AttachmentCategory;
  textPreview?: string;
}

export interface ChatMessage {
  id: string;
  role: "system" | "user" | "assistant";
  text: string;
  createdAt: string;
  attachments?: UploadedFileMetadata[];
  artifacts?: Artifact[];
  generatedFiles?: GeneratedFile[];
}

export interface Artifact {
  id: string;
  title: string;
  description?: string;
  /**
   * Sanitised markup used for inline preview cards.
   */
  previewHtml: string;
  /**
   * Full micro-app markup rendered inside a sandboxed iframe.
   */
  fullHtml: string;
}

export interface GeneratedFile {
  id: string;
  filename: string;
  type: "pdf" | "docx" | "txt" | "csv" | "md";
  downloadUrl: string;
  summary?: string;
  storedFilename: string;
}

export interface ChatRequestPayload {
  messages: Array<{
    id: string;
    role: "system" | "user" | "assistant";
    text: string;
    attachments?: UploadedFileMetadata[];
  }>;
  temperature?: number;
}

export interface ChatResponsePayload {
  message: ChatMessage;
}
