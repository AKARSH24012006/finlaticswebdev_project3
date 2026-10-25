// Step 3 + 4 + 5 — Chunk (500 tokens / 50 overlap), embed (OpenAI), store (pgvector).
// POST { docId }
import crypto from "crypto";
import { query, getPool, ensureSchema, DOC_COLUMNS } from "../../lib/db";
import { chunkText } from "../../lib/chunker";
import { embedMany, toVectorLiteral } from "../../lib/embedder";
import { sendError } from "../../lib/http";

export const config = { maxDuration: 60 };

const INSERT_BATCH = 50;
const UUID_RE = /^[0-9a-f-]{36}$/i;

async function storeChunks(documentId, chunks, vectors) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM chunks WHERE document_id = $1", [documentId]); // idempotent re-processing
    for (let i = 0; i < chunks.length; i += INSERT_BATCH) {
      const rows = chunks.slice(i, i + INSERT_BATCH);
      const params = [];
      const values = rows.map((c, j) => {
        const b = params.length;
        params.push(crypto.randomUUID(), documentId, c.index, c.content, c.tokenCount, toVectorLiteral(vectors[i + j]));
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}::vector)`;
      });
      await client.query(
        `INSERT INTO chunks (id, document_id, chunk_index, content, token_count, embedding) VALUES ${values.join(",")}`,
        params
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const docId = String((req.body && req.body.docId) || "");
  if (!UUID_RE.test(docId)) return res.status(400).json({ error: "A valid docId is required" });

  try {
    await ensureSchema();
    const found = await query("SELECT id, status, chunk_count, text FROM documents WHERE id = $1", [docId]);
    const doc = found.rows[0];
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.status === "ready") {
      const r = await query(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = $1`, [docId]);
      return res.status(200).json({ document: r.rows[0] });
    }

    await query("UPDATE documents SET status = 'processing', error = NULL WHERE id = $1", [docId]);
    try {
      const chunks = chunkText(doc.text); // 3. chunk — 500 tokens, 50 overlap
      if (!chunks.length) throw Object.assign(new Error("Document produced no chunks."), { status: 422 });

      const vectors = await embedMany(chunks.map((c) => c.content)); // 4. embed — text-embedding-3-small
      await storeChunks(docId, chunks, vectors); // 5. store — pgvector

      const { rows } = await query(
        `UPDATE documents SET status = 'ready', chunk_count = $2 WHERE id = $1 RETURNING ${DOC_COLUMNS}`,
        [docId, chunks.length]
      );
      return res.status(200).json({
        document: rows[0],
        stats: { chunks: chunks.length, totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0) },
      });
    } catch (inner) {
      await query("UPDATE documents SET status = 'failed', error = $2 WHERE id = $1", [docId, String(inner.message).slice(0, 500)]);
      throw inner;
    }
  } catch (err) {
    return sendError(res, err);
  }
}
