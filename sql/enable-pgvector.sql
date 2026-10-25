-- Schema for the RAG pipeline. The app runs this automatically on first
-- request (lib/db.js -> ensureSchema), or run it yourself: npm run db:init
-- or paste it into the Neon / Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY,
  title       TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  page_count  INTEGER NOT NULL DEFAULT 0,
  char_count  INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'uploaded',   -- uploaded | processing | ready | failed
  error       TEXT,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  embedding   vector(1536)                         -- OpenAI text-embedding-3-small
);

-- SHA-256 of the extracted text: identical PDFs reuse existing embeddings
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE INDEX IF NOT EXISTS documents_content_hash_idx ON documents(content_hash);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);

-- Approximate-nearest-neighbour index for cosine distance (<=>)
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);
