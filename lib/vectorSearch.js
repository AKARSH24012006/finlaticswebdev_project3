// Step 6 — Vector similarity search: pgvector cosine similarity, top 5 chunks.
//
//   cosine_similarity = 1 - (embedding <=> query_embedding)
//
// `<=>` is pgvector's cosine DISTANCE operator. ORDER BY embedding <=> query
// is served by the HNSW `vector_cosine_ops` index created in lib/db.js.
// Chunks below MIN_SIMILARITY are dropped so weakly related text never
// reaches the LLM's context window.
const { query } = require("./db");
const { toVectorLiteral } = require("./embedder");

const TOP_K = 5;
const MIN_SIMILARITY = Number(process.env.MIN_SIMILARITY || 0.3);

async function vectorSimilaritySearch(queryEmbedding, documentId, k = TOP_K, minSimilarity = MIN_SIMILARITY) {
  const { rows } = await query(
    `SELECT id, chunk_index, content, token_count,
            1 - (embedding <=> $1::vector) AS cosine_similarity
       FROM chunks
      WHERE document_id = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    [toVectorLiteral(queryEmbedding), documentId, k]
  );
  return rows
    .map((r) => ({
      id: r.id,
      index: Number(r.chunk_index),
      content: r.content,
      tokenCount: Number(r.token_count),
      similarity: Number(r.cosine_similarity),
    }))
    .filter((c) => c.similarity >= minSimilarity);
}

module.exports = { search: vectorSimilaritySearch, vectorSimilaritySearch, TOP_K, MIN_SIMILARITY };
