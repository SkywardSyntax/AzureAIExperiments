## Azure AI Artifact Studio

An end-to-end reference app that showcases the Azure OpenAI **Responses API** with the `gpt-4.1` model. The experience lets users:

- Upload images (stored locally on the server) or text-based files for multimodal analysis.
- Ask questions about their uploads through a chat interface.
- Let the model call structured **function tools** that:
  - Produce interactive micro-applets (artifacts) rendered inside the chat UI.
  - Generate downloadable files (PDF, DOCX, TXT, CSV, Markdown) from model output.

All Azure OpenAI interactions follow the Responses API guidance from Microsoft documentation.citeturn0mcp__microsoft_docs_mcp__microsoft_docs_fetch0

---

### Prerequisites

- Node.js 18.17+ (Next.js requirement)
- Azure OpenAI resource with a deployed `gpt-4.1` (or higher) model
- Azure OpenAI API key (Azure AI Foundry key)

---

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables**

   Fill `.env` (created for you) or copy `.env.example` to `.env.local`:
   ```ini
   AZURE_OPENAI_API_KEY=your-azure-openai-foundry-key
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT=gpt-4.1
   AZURE_OPENAI_API_VERSION=2024-12-01-preview
   ```

   > Only the API key is secret, but the endpoint and deployment name are required so the client can call Azure OpenAI.

3. **Run the dev server**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000

---

### How it works

- **Uploads API** (`POST /api/upload`): saves files in `public/uploads/`, classifies them (image vs text), and returns metadata plus a text preview for structured prompts.
- **Chat API** (`POST /api/chat`):
  - Converts prior messages and attachments into Responses API `input_*` content.
  - Registers two functions: `create_artifact` (micro-applets) and `create_document` (file exports).
  - Executes function calls synchronously so tool outputs are immediately visible.
- **Document helpers** (`src/lib/documentFactory.ts`): turn model text into PDFs (PDFKit), DOCX (docx), TXT/CSV/MD buffers and expose them via `/api/generated/[file]`.
- **Client UI** (`src/app/page.tsx`):
  - Rich chat surface with inline attachment previews.
  - Artifact cards render safe previews and launch a sandboxed iframe so the generated micro-app can run.
  - Generated files appear as download chips.

---

### Key files

| Path | Purpose |
| ---- | ------- |
| `src/app/api/chat/route.ts` | Orchestrates Azure OpenAI Responses calls, function tools, and structured attachments. |
| `src/app/api/upload/route.ts` | Handles multi-file uploads and server-side storage. |
| `src/app/page.tsx` | Client-side chat experience with artifact & file preview logic. |
| `src/lib` | Azure client, file helpers, document generation, and type definitions. |

---

### Next steps

- Configure authentication (Azure Entra ID) if you need managed identities.
- Persist chat history & file metadata in durable storage (e.g., Azure Blob Storage + Cosmos DB).
- Harden sandboxing for artifacts if you expect untrusted users—e.g., sign HTML payloads or add CSP headers.

---

### References

- Azure OpenAI **Responses API** overview and function calling examples.citeturn0mcp__microsoft_docs_mcp__microsoft_docs_fetch0
