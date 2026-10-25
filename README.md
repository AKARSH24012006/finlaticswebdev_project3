# The Reading Room — AI Chatbot with Document RAG

Finlatics ANDP **Project-3**: upload a PDF, ask questions about it, and get answers streamed
back in real time, grounded **only** in the document, with every claim cited to the chunk it came from.

## RAG pipeline

| # | Step | Implementation | File |
|---|------|----------------|------|
| 1 | PDF uploaded | multipart upload via `formidable` (≤ 4 MB, `%PDF-` magic-byte check) | `pages/api/upload.js` |
| 2 | Text extracted | `pdf-parse` | `lib/pdfExtractor.js` |
| 3 | Chunked | **500 tokens, 50-token overlap** (cl100k_base via `gpt-tokenizer`) | `lib/chunker.js` |
| 4 | Embedded | OpenAI **`text-embedding-3-small`** (1536-d), batched | `lib/embedder.js` |
| 5 | Stored | PostgreSQL + **pgvector** `vector(1536)` with HNSW `vector_cosine_ops` index | `pages/api/process.js`, `sql/enable-pgvector.sql` |
| 6 | Searched | **cosine similarity** (`1 - (embedding <=> query)`), **top 5** chunks | `lib/vectorSearch.js` |
| 7 | Answered | LLM + retrieved context, **streamed over SSE**, numbered **source citations** | `lib/claudeRAG.js`, `pages/api/chat.js` |

**Answer model:** Claude (Anthropic) when `ANTHROPIC_API_KEY` is set; otherwise it falls back
automatically to OpenAI (`gpt-4o-mini`), so the whole app runs on a single OpenAI key.

### Core concepts covered
- **Chunking:** 500-token sliding window, step 450, so consecutive chunks share 50 tokens and no sentence is lost at a boundary (`npm test` verifies this).
- **Embeddings:** `text-embedding-3-small`; the question is embedded with the same model as the chunks.
- **Vector similarity:** pgvector cosine distance `<=>`, served by an HNSW index.
- **Context window:** the top 5 chunks are numbered `[1]…[5]` and injected into the prompt.
- **Streaming response:** Server-Sent Events (`sources` → `token`… → `done`) over a POST response, read in the browser with `fetch` + `ReadableStream` (`lib/sseClient.js`), since `EventSource` can't POST.
- **Source citations:** the model must cite `[n]`; the UI turns each into a clickable chip that jumps to the retrieved chunk, shown with its cosine similarity score.

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/upload` | multipart `file` → extract text → create document |
| POST | `/api/process` | `{ docId }` → chunk → embed → store vectors |
| POST | `/api/chat` | `{ docId, question, history? }` → SSE stream |
| GET | `/api/documents` | list documents |
| GET / DELETE | `/api/documents/:id` | document metadata / delete (chunks cascade) |
| GET | `/api/health` | shows which services are configured (no secrets) |

## Run locally

```bash
cp .env.example .env      # set DATABASE_URL and OPENAI_API_KEY
npm install
npm run db:init           # optional: the app also creates the schema on first request
npm run dev               # http://localhost:3000
npm test                  # chunker test: 500 tokens / 50 overlap
```

You need Postgres with pgvector. The free tier of [Neon](https://neon.tech) works out of the box.

## Deploy (Vercel + Neon)

1. Create a Neon project and copy its connection string.
2. Import this repo in Vercel and add the environment variables `DATABASE_URL` and `OPENAI_API_KEY` (and optionally `ANTHROPIC_API_KEY`).
3. Deploy. The tables, the `vector` extension and the HNSW index are created automatically on the first request.

## Stack

Next.js 14 (pages router) · React 18 · PostgreSQL + pgvector (`pg`) · OpenAI embeddings · Claude / OpenAI chat · SSE
