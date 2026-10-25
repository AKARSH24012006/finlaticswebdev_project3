// Postgres (pgvector) connection pool + one-time schema bootstrap.
// ensureSchema() is safe to call on every request: it runs once per server
// instance and creates the vector extension, tables and the HNSW cosine index.
const { Pool } = require("pg");

const g = globalThis;

function getPool() {
  if (!process.env.DATABASE_URL) {
    const err = new Error("DATABASE_URL is not set. Add a pgvector-enabled Postgres connection string.");
    err.status = 503;
    throw err;
  }
  if (!g.__pgPool) {
    const url = process.env.DATABASE_URL;
    const local = /localhost|127\.0\.0\.1/.test(url);
    g.__pgPool = new Pool({
      connectionString: url,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
    });
  }
  return g.__pgPool;
}

function query(text, params) {
  return getPool().query(text, params);
}

// Same SQL as sql/enable-pgvector.sql (kept there so it can be run by hand).
const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY,
  title       TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  page_count  INTEGER NOT NULL DEFAULT 0,
  char_count  INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'uploaded',
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
  embedding   vector(1536)
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks(document_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);
`;

function ensureSchema() {
  if (!g.__schemaReady) {
    g.__schemaReady = (async () => {
      await query(SCHEMA_SQL);
    })().catch((e) => {
      g.__schemaReady = null; // retry on next request
      throw e;
    });
  }
  return g.__schemaReady;
}

// Public shape of a document row (never includes the full text).
const DOC_COLUMNS = `id, title, file_name AS "fileName", page_count AS "pageCount", char_count AS "charCount",
  chunk_count AS "chunkCount", status, error, created_at AS "createdAt"`;

module.exports = { query, getPool, ensureSchema, SCHEMA_SQL, DOC_COLUMNS };
