"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Artifact,
  ChatMessage,
  GeneratedFile,
  UploadedFileMetadata,
} from "@/lib/types";

const systemPrompt = [
  "You are Azure Artifact Studio, a multimodal analyst that inspects images and text files uploaded by the user.",
  "When files are provided, incorporate their contents explicitly in your reasoning before responding.",
  "If the user asks for an interactive demo or visualization, build it with the create_artifact function. Keep artifacts lightweight and client-friendly.",
  "Use the create_document function whenever the user requests a downloadable asset such as a PDF, DOCX, text, CSV, or Markdown file.",
  "Provide concise explanations and call out any assumptions you make.",
].join(" ");

type PendingAttachment = UploadedFileMetadata;

const createMessageId = () => crypto.randomUUID();

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: createMessageId(),
      role: "system",
      text: systemPrompt,
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role !== "system"),
    [messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages.length]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = (await response.json()) as { files: UploadedFileMetadata[] };
      setPendingAttachments((prev) => [...prev, ...data.files]);
    } catch (err) {
      console.error(err);
      setError("We couldn't upload one or more files. Try again.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || isSending || isUploading) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      text: input.trim(),
      createdAt: new Date().toISOString(),
      attachments: pendingAttachments,
    };

    const conversation = [...messages, userMessage];

    setMessages(conversation);
    setPendingAttachments([]);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const payload = {
        messages: conversation.map((message) => ({
          id: message.id,
          role: message.role,
          text: message.text,
          attachments: message.attachments,
        })),
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Chat request failed");
      }

      const data = (await response.json()) as { message: ChatMessage };
      setMessages((prev) => [...prev, data.message]);
    } catch (err) {
      console.error(err);
      setError("Something went wrong generating a response. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="border-b border-white/5 bg-black/30 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Azure AI Artifact Studio
            </h1>
            <p className="text-sm text-slate-400">
              Inspect images & text, orchestrate artifacts, and export documents with GPT-4.1 via Azure OpenAI Responses API.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {isUploading && <span className="animate-pulse text-amber-300">Uploading…</span>}
            {isSending && <span className="animate-pulse text-emerald-300">Thinking…</span>}
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="flex-1 space-y-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl backdrop-blur">
          <div className="hidden text-sm text-slate-400 md:block">
            Drop images or text files below. Each response can include live micro-applets and downloadable documents.
          </div>

          <div className="scroll-area relative h-[58vh] overflow-y-auto pr-2">
            <div className="space-y-6">
              {visibleMessages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  onSelectArtifact={setSelectedArtifact}
                />
              ))}
            </div>
            <div ref={bottomRef} />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="group cursor-pointer rounded-full border border-dashed border-slate-500/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300">
                <span>Attach files</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.txt,.md,.csv,.json,.xml"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-400">
                JPG, PNG, GIF, PDF (vision supported), TXT, CSV, JSON, Markdown
              </span>
            </div>

            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-slate-200">
                {pendingAttachments.map((attachment) => (
                  <AttachmentChip
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={handleRemoveAttachment}
                  />
                ))}
              </div>
            )}

            <div className="flex items-end gap-4">
              <textarea
                required
                placeholder="Ask about your uploads or request an artifact…"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                className="flex-1 resize-none rounded-2xl border border-transparent bg-black/40 px-4 py-3 text-sm text-white shadow-inner outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="submit"
                disabled={isSending || isUploading}
                className={clsx(
                  "inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition",
                  isSending || isUploading
                    ? "cursor-not-allowed bg-slate-600 text-slate-300"
                    : "bg-emerald-500 text-black hover:bg-emerald-400",
                )}
              >
                Send
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}
          </form>
        </section>
      </main>

      <ArtifactModal artifact={selectedArtifact} onClose={() => setSelectedArtifact(null)} />
    </div>
  );
}

function ChatBubble({
  message,
  onSelectArtifact,
}: {
  message: ChatMessage;
  onSelectArtifact: (artifact: Artifact) => void;
}) {
  const isAssistant = message.role === "assistant";
  const hasArtifacts = (message.artifacts?.length ?? 0) > 0;
  const hasGeneratedFiles = (message.generatedFiles?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/40 p-5 text-sm text-slate-200 shadow-lg">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <span
          className={clsx(
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
            isAssistant ? "bg-emerald-500 text-black" : "bg-slate-700 text-slate-200",
          )}
        >
          {isAssistant ? "AI" : "You"}
        </span>
        <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
      </div>

      <div className="prose prose-invert max-w-none whitespace-pre-wrap text-[15px] leading-relaxed">
        {message.text}
      </div>

      {message.attachments && message.attachments.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {message.attachments.map((attachment) => (
            <AttachmentCard key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}

      {hasArtifacts && (
        <div className="grid gap-4 md:grid-cols-2">
          {message.artifacts!.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onSelect={() => onSelectArtifact(artifact)}
            />
          ))}
        </div>
      )}

      {hasGeneratedFiles && (
        <GeneratedFilesList files={message.generatedFiles!} />
      )}
    </div>
  );
}

function AttachmentCard({ attachment }: { attachment: UploadedFileMetadata }) {
  const isImage = attachment.category === "image";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-inner">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.publicUrl}
          alt={attachment.originalName}
          className="h-48 w-full object-cover"
        />
      ) : (
        <div className="h-48 w-full overflow-y-auto bg-slate-900/60 p-4 text-xs text-slate-200">
          <pre className="whitespace-pre-wrap">{attachment.textPreview ?? "Text preview unavailable."}</pre>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-white/10 bg-black/50 px-4 py-3 text-xs text-slate-300">
        <span className="truncate font-medium">{attachment.originalName}</span>
        <span>{formatBytes(attachment.size)}</span>
      </div>
    </div>
  );
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: UploadedFileMetadata;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs">
      <span className="truncate max-w-[12rem] font-medium text-slate-200">
        {attachment.originalName}
      </span>
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-100 transition hover:bg-rose-500/80 hover:text-white"
      >
        Remove
      </button>
    </div>
  );
}

function ArtifactCard({
  artifact,
  onSelect,
}: {
  artifact: Artifact;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-left transition hover:border-emerald-400 hover:bg-emerald-500/10"
    >
      <div className="relative h-40 overflow-hidden border-b border-emerald-400/20 bg-black/40">
        <div
          className="h-full w-full scale-[0.85] transform p-2 opacity-80 transition group-hover:scale-95 group-hover:opacity-100"
          dangerouslySetInnerHTML={{ __html: artifact.previewHtml }}
        />
        <div className="absolute inset-0 rounded-t-2xl bg-gradient-to-t from-black/60 via-transparent to-black/10 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="flex-1 space-y-2 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
          Interactive Artifact
        </div>
        <div className="text-sm font-medium text-white">{artifact.title}</div>
        {artifact.description && (
          <p className="line-clamp-2 text-xs text-emerald-200/80">
            {artifact.description}
          </p>
        )}
        <span className="text-xs font-medium text-emerald-300">
          View live preview →
        </span>
      </div>
    </button>
  );
}

function ArtifactModal({
  artifact,
  onClose,
}: {
  artifact: Artifact | null;
  onClose: () => void;
}) {
  if (!artifact) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
      <div className="relative flex h-[80vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-3xl border border-emerald-400/40 bg-slate-950 shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{artifact.title}</h2>
            {artifact.description && (
              <p className="text-sm text-slate-300">{artifact.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
          >
            Close
          </button>
        </header>
        <div className="flex-1 bg-black">
          <iframe
            title={artifact.title}
            srcDoc={artifact.fullHtml}
            sandbox="allow-scripts allow-forms allow-pointer-lock allow-same-origin"
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}

function GeneratedFilesList({ files }: { files: GeneratedFile[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-emerald-500/5 p-4 text-xs text-emerald-100">
      <span className="font-semibold uppercase tracking-wide text-emerald-300">
        Generated files
      </span>
      {files.map((file) => (
        <a
          key={file.id}
          href={file.downloadUrl}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/20 px-3 py-1 font-medium text-emerald-100 transition hover:bg-emerald-400/40"
          download
        >
          <span className="text-emerald-200">{file.type.toUpperCase()}</span>
          <span className="truncate max-w-[10rem] text-emerald-50">
            {file.filename}
          </span>
        </a>
      ))}
    </div>
  );
}

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
