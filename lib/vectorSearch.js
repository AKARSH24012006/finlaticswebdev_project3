// Step 6 — Cosine similarity search in pgvector, top 5 chunks.
// `<=>` is pgvector's cosine DISTANCE operator, so similarity = 1 - distance.
// ORDER BY embedding <=> query uses the HNSW vector_cosine_ops index.
const { query } = require("./db");
const { toVectorLiteral } = require("./embedder");

const TOP_K = 5;

async function search(queryEmbedding, documentId, k = TOP_K) {
  const { rows } = await query(
    `SELECT id, chunk_index, content, token_count,
            1 - (embedding <=> $1::vector) AS similarity
       FROM chunks
      WHERE document_id = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    [toVectorLiteral(queryEmbedding), documentId, k]
  );
  return rows.map((r) => ({
    id: r.id,
    index: Number(r.chunk_index),
    content: r.content,
    tokenCount: Number(r.token_count),
    similarity: Number(r.similarity),
  }));
}

module.exports = { search, TOP_K };
